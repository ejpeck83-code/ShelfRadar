import { describe, expect, it } from "vitest";
import { TargetAdapter } from "@/adapters/retail/target";
import { MemoryCatalogRepository } from "@/db/repositories/memory-catalog";
import { runDiscovery } from "@/ingestion/run-discovery";

describe("fixture ingestion", () => {
  it("persists and replays without duplicate products, listings, or observations", async () => {
    const repository = new MemoryCatalogRepository(); const adapter = new TargetAdapter("fixture"); const now = new Date("2026-07-18T16:00:00.000Z");
    const first = await runDiscovery({ adapter, repository, now, runKey: "run:first", terms: ["TMNT"] });
    const replay = await runDiscovery({ adapter, repository, now, runKey: "run:replay", terms: ["TMNT", "TMNT"] });
    expect(first).toMatchObject({ status: "SUCCEEDED", counts: { fetched: 3, parsed: 3, created: 3, failed: 0 } });
    expect(replay.counts.created).toBe(0);
    expect(repository.products.size).toBe(3); expect(repository.listings.size).toBe(3); expect(repository.observations.size).toBe(4);
  });
  it("does not rerun the same ingestion run key", async () => {
    const repository = new MemoryCatalogRepository(); const adapter = new TargetAdapter("fixture"); const now = new Date("2026-07-18T16:00:00.000Z");
    const first = await runDiscovery({ adapter, repository, now, runKey: "same", terms: ["TMNT"] });
    const same = await runDiscovery({ adapter, repository, now, runKey: "same", terms: ["TMNT"] });
    expect(same).toEqual(first); expect(repository.products.size).toBe(3);
  });
});
