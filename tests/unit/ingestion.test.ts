import { describe, expect, it, vi } from "vitest";
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
  it("records the adapter parser version on the ingestion run", async () => {
    const repository = new MemoryCatalogRepository();
    const startRun = vi.spyOn(repository, "startRun");
    const adapter = {
      sourceKey: "custom-retailer",
      parserVersion: "custom-retailer-v2",
      capabilities: ["product_discovery"] as const,
      async discover() {
        return { kind: "success" as const, items: [], fetchedAt: "2026-07-18T16:00:00.000Z" };
      }
    };

    await runDiscovery({ adapter, repository, now: new Date("2026-07-18T16:00:00.000Z"), runKey: "custom:first", terms: ["TMNT"] });

    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({ parserVersion: "custom-retailer-v2" }));
  });
  it("closes the ingestion run when an adapter throws unexpectedly", async () => {
    const repository = new MemoryCatalogRepository();
    const adapter = {
      sourceKey: "throwing-retailer",
      parserVersion: "throwing-v1",
      capabilities: ["product_discovery"] as const,
      async discover(): Promise<never> { throw new Error("untrusted provider detail"); }
    };
    const result = await runDiscovery({ adapter, repository, now: new Date("2026-07-18T16:00:00.000Z"), runKey: "throwing:first", terms: ["TMNT"] });
    expect(result).toMatchObject({ status: "FAILED", message: "Retail adapter failed without a structured result", counts: { failed: 1 } });
    expect(repository.runs.get("throwing:first")?.status).toBe("FAILED");
  });
});
