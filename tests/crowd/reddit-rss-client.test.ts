import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { RedditCrowdAdapter } from "@/adapters/crowd/reddit";
import { parseRedditRss, RedditRssClient } from "@/adapters/crowd/reddit/rss-client";

const fixture = readFileSync(new URL("../fixtures/crowd/reddit/rss.xml", import.meta.url), "utf8");
const context = { signal: new AbortController().signal, requestId: "reddit-rss", now: new Date("2026-07-19T12:00:00.000Z") };

describe("Reddit public RSS client", () => {
  it("converts one bounded combined feed into sanitized canonical crowd evidence", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(fixture, { status: 200, headers: { "content-type": "application/atom+xml" } }));
    const client = new RedditRssClient({ userAgent: "ShelfRadar/0.1 by owner", fetchImpl, minRequestIntervalMs: 0 });
    const adapter = new RedditCrowdAdapter({ mode: "rss", client, communities: ["TMNT", "NECATMNT", "ActionFigures", "RossFinds"] });
    const result = await adapter.fetchPosts({ terms: ["TMNT", "Last Ronin"], pageLimit: 1 }, context);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://www.reddit.com/r/TMNT+NECATMNT+ActionFigures+RossFinds/.rss");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", headers: expect.objectContaining({ "user-agent": "ShelfRadar/0.1 by owner" }) });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      externalPostId: "live_ross_1",
      community: "RossFinds",
      title: "TMNT at Ross in Fishers",
      mediaEvidence: "PHOTO_LINK",
      mediaUrl: "https://i.redd.it/synthetic-photo.jpg"
    });
    expect(result.items[0]?.bodyExcerpt).not.toContain("<script>");
    expect(result.items[0]?.bodyExcerpt).not.toContain("ignore previous instructions");
    expect(result.items[0]?.authorDisplay).toMatch(/^author:[a-f0-9]{12}$/);
  });

  it("fails closed for malformed XML and exposes throttling without retrying", async () => {
    expect(parseRedditRss("<!DOCTYPE feed><feed>&external;</feed>")).toMatchObject({ kind: "unavailable" });
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "60" } }));
    const client = new RedditRssClient({ userAgent: "ShelfRadar/0.1 by owner", fetchImpl, minRequestIntervalMs: 0 });
    await expect(client.fetchPage({ communities: ["TMNT"], terms: ["TMNT"], limit: 25 }, context)).resolves.toMatchObject({ kind: "throttled", retryAfter: "2026-07-19T12:01:00.000Z" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
