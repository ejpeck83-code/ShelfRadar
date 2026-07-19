import { describe, expect, it, vi } from "vitest";
import fixturePage from "../fixtures/crowd/reddit/posts.json";
import malformedPage from "../fixtures/crowd/reddit/malformed.json";
import {
  DEFAULT_REDDIT_COMMUNITIES,
  RedditCrowdAdapter,
  encodeRedditCheckpoint,
  parseRedditPage,
  type RedditApprovedAccessClient
} from "@/adapters/crowd/reddit";

const now = new Date("2026-07-18T18:00:00.000Z");
const context = { signal: new AbortController().signal, requestId: "crowd-contract", now };

describe("Reddit crowd adapter contract", () => {
  it("declares configured communities and parses sanitized fixture posts deterministically", async () => {
    const adapter = new RedditCrowdAdapter({ mode: "fixture", fixturePages: [fixturePage] });
    const result = await adapter.fetchPosts({ terms: ["TMNT", "Last Ronin", "Teenage Mutant Ninja Turtles"], pageLimit: 2 }, context);

    expect(adapter.sourceKey).toBe("reddit");
    expect(adapter.capabilities).toEqual(["crowd_posts"]);
    expect(adapter.communities).toEqual(DEFAULT_REDDIT_COMMUNITIES);
    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(new Set(result.items.map((post) => post.community))).toEqual(new Set(DEFAULT_REDDIT_COMMUNITIES));
    expect(result.items).toHaveLength(9);
    expect(result.items.every((post) => post.provenance.parserVersion === "reddit-v1")).toBe(true);
    expect(result.items.find((post) => post.externalPostId === "ross_local_1")?.bodyExcerpt).not.toContain("<script>");
    expect(result.items.find((post) => post.externalPostId === "ross_local_1")?.bodyExcerpt).not.toContain("ignore previous instructions");
    expect(result.items.find((post) => post.externalPostId === "ross_local_1")?.authorDisplay).toMatch(/^author:[a-f0-9]{12}$/);
    expect(result.nextCursor).toBe(encodeRedditCheckpoint("t3_ross_local_1"));
  });

  it("distinguishes unavailable, throttled, aborted, and malformed outcomes", async () => {
    expect(await new RedditCrowdAdapter({ mode: "unavailable" }).fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context)).toMatchObject({ kind: "unavailable" });
    expect(parseRedditPage(malformedPage, now)).toMatchObject({ kind: "malformed" });

    const throttled: RedditApprovedAccessClient = { fetchPage: vi.fn().mockResolvedValue({ kind: "throttled", retryAfter: "2026-07-18T18:05:00.000Z" }) };
    expect(await new RedditCrowdAdapter({ mode: "oauth", client: throttled }).fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context)).toEqual({ kind: "throttled", retryAfter: "2026-07-18T18:05:00.000Z" });

    const controller = new AbortController();
    controller.abort();
    expect(await new RedditCrowdAdapter({ mode: "fixture", fixturePages: [fixturePage] }).fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, { ...context, signal: controller.signal })).toMatchObject({ kind: "unavailable", reason: "Reddit request aborted" });
  });

  it("bounds pagination and stops incremental reads at the prior checkpoint", async () => {
    const secondPage = structuredClone(fixturePage);
    secondPage.data.children = secondPage.data.children.slice(0, 1);
    secondPage.data.children[0]!.data.id = "older_1";
    secondPage.data.children[0]!.data.name = "t3_older_1";
    secondPage.data.after = null;
    const firstPage: { data: { after: string | null; children: typeof fixturePage.data.children }; kind: string } = structuredClone(fixturePage);
    firstPage.data.children = firstPage.data.children.slice(0, 2);
    firstPage.data.after = "t3_next";
    const client: RedditApprovedAccessClient = {
      fetchPage: vi.fn()
        .mockResolvedValueOnce({ kind: "success", payload: firstPage })
        .mockResolvedValueOnce({ kind: "success", payload: secondPage })
    };
    const adapter = new RedditCrowdAdapter({ mode: "oauth", client, maxPagesPerRun: 2 });
    const result = await adapter.fetchPosts({ terms: ["TMNT", "Last Ronin"], pageLimit: 20, checkpoint: encodeRedditCheckpoint("t3_ross_regional_1") }, context);

    expect(client.fetchPage).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("success");
    if (result.kind === "success") expect(result.items.map((post) => post.externalPostId)).toEqual(["ross_local_1"]);
  });
});
