import { describe, expect, it } from "vitest";
import { WalmartAdapter } from "@/adapters/retail/walmart";
import { TargetAdapter } from "@/adapters/retail/target";
import { MemoryCatalogRepository } from "@/db/repositories/memory-catalog";
import { runDiscovery } from "@/ingestion/run-discovery";

describe("retail fixture duplicate replay", () => {
  it("does not duplicate Walmart products, listings, identifiers, or observations", async () => {
    const repository = new MemoryCatalogRepository();
    const adapter = new WalmartAdapter("fixture");
    const now = new Date("2026-07-18T16:30:00.000Z");
    const first = await runDiscovery({ adapter, repository, now, runKey: "walmart:first", terms: ["TMNT"] });
    const counts = { products: repository.products.size, listings: repository.listings.size, identifiers: repository.identifiers.length, observations: repository.observations.size };
    const replay = await runDiscovery({ adapter, repository, now, runKey: "walmart:replay", terms: ["TMNT", "TMNT"] });
    expect(first).toMatchObject({ status: "SUCCEEDED", counts: { fetched: 2, parsed: 2, created: 2, failed: 0 } });
    expect(replay.counts.created).toBe(0);
    expect({ products: repository.products.size, listings: repository.listings.size, identifiers: repository.identifiers.length, observations: repository.observations.size }).toEqual(counts);
  });
  it("merges Target and Walmart listings that share an exact UPC", async () => {
    const repository = new MemoryCatalogRepository();
    const now = new Date("2026-07-18T16:30:00.000Z");

    await runDiscovery({ adapter: new TargetAdapter("fixture"), repository, now, runKey: "cross-retailer:target", terms: ["TMNT"] });
    await runDiscovery({ adapter: new WalmartAdapter("fixture"), repository, now, runKey: "cross-retailer:walmart", terms: ["TMNT"] });

    expect(repository.products.size).toBe(4);
    expect(repository.listings.size).toBe(5);
    const sharedUpc = repository.identifiers.filter((identifier) => identifier.kind === "UPC" && identifier.valueNormalized === "634482541333");
    expect(new Set(sharedUpc.map((identifier) => identifier.productId)).size).toBe(1);
  });
});
