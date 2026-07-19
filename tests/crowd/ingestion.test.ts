import { describe, expect, it, vi } from "vitest";
import fixturePage from "../fixtures/crowd/reddit/posts.json";
import { RedditCrowdAdapter } from "@/adapters/crowd/reddit";
import { DEFAULT_CROWD_TERMS } from "@/features/sightings/parser";
import { runCrowdDiscovery } from "@/ingestion/run-crowd-discovery";
import type { IngestionRunRecord } from "@/ingestion/contracts";

const now = new Date("2026-07-18T18:00:00.000Z");
function repository(options: { failPost?: boolean } = {}) {
  const run: IngestionRunRecord = {
    id: "run-1",
    runKey: "crowd:first",
    sourceKey: "reddit",
    jobType: "crowd_posts",
    parserVersion: "reddit-v1",
    startedAt: now,
    status: "RUNNING",
    counts: { fetched: 0, parsed: 0, created: 0, updated: 0, ignored: 0, failed: 0 }
  };
  return {
    startRun: vi.fn().mockResolvedValue(run),
    finishRun: vi.fn().mockResolvedValue(undefined),
    latestCheckpoint: vi.fn().mockResolvedValue("reddit:v1:t3_prior"),
    loadProductCandidates: vi.fn().mockResolvedValue([]),
    persistPost: vi.fn().mockImplementation(async (post: { externalPostId: string }) => {
      if (options.failPost) throw new Error("synthetic persistence failure");
      return { id: post.externalPostId, created: true };
    }),
    persistSighting: vi.fn().mockResolvedValue({ created: true, candidateCount: 0 })
  };
}

describe("crowd ingestion orchestration", () => {
  it("commits the new checkpoint only after persistence succeeds", async () => {
    const store = repository();
    const adapter = new RedditCrowdAdapter({ mode: "fixture", fixturePages: [fixturePage] });
    const result = await runCrowdDiscovery({ adapter, repository: store, now, runKey: "crowd:first", terms: DEFAULT_CROWD_TERMS, queryTerms: ["TMNT"], pageLimit: 2 });

    expect(store.latestCheckpoint).toHaveBeenCalledWith("reddit", "crowd_posts");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.cursor).toBe("reddit:v1:t3_ross_local_1");
    expect(store.finishRun).toHaveBeenCalledWith(expect.objectContaining({ status: "SUCCEEDED", cursor: "reddit:v1:t3_ross_local_1" }));
  });

  it("keeps the prior checkpoint when persistence fails", async () => {
    const store = repository({ failPost: true });
    const adapter = new RedditCrowdAdapter({ mode: "fixture", fixturePages: [fixturePage] });
    const result = await runCrowdDiscovery({ adapter, repository: store, now, runKey: "crowd:first", terms: DEFAULT_CROWD_TERMS, queryTerms: ["TMNT"], pageLimit: 1 });

    expect(result.status).toBe("FAILED");
    expect(result.cursor).toBeUndefined();
    expect(store.finishRun).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
    expect(store.finishRun.mock.calls[0]?.[0]).not.toHaveProperty("cursor");
  });

  it("closes the ingestion run when an adapter throws unexpectedly", async () => {
    const store = repository();
    const adapter = {
      sourceKey: "reddit",
      parserVersion: "throwing-v1",
      capabilities: ["crowd_posts"] as const,
      async fetchPosts(): Promise<never> { throw new Error("untrusted provider detail"); }
    };
    const result = await runCrowdDiscovery({ adapter, repository: store, now, runKey: "crowd:first", terms: DEFAULT_CROWD_TERMS, queryTerms: ["TMNT"] });
    expect(result).toMatchObject({ status: "FAILED", message: "Crowd adapter failed without a structured result", counts: { failed: 1 } });
    expect(store.finishRun).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED" }));
  });
});
