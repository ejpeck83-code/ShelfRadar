import { MeijerAdapter } from "../src/adapters/retail/meijer";
import { NecaAdapter } from "../src/adapters/retail/neca";
import { ConfiguredOnlineRetailerAdapter } from "../src/adapters/retail/online";
import { TargetAdapter } from "../src/adapters/retail/target";
import { WalmartAdapter } from "../src/adapters/retail/walmart";
import { MemoryCatalogRepository } from "../src/db/repositories/memory-catalog";
import { runDiscovery } from "../src/ingestion/run-discovery";

const repository = new MemoryCatalogRepository();
const now = new Date("2026-07-18T16:30:00.000Z");
const adapters = [
  new TargetAdapter("fixture"),
  new WalmartAdapter("fixture"),
  new MeijerAdapter("fixture"),
  new NecaAdapter("fixture"),
  new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "fixture" })
] as const;

const runs = [];
for (const adapter of adapters) {
  const first = await runDiscovery({ adapter, repository, now, runKey: `retail-demo:${adapter.sourceKey}:first`, terms: ["TMNT"] });
  const replay = await runDiscovery({ adapter, repository, now, runKey: `retail-demo:${adapter.sourceKey}:replay`, terms: ["TMNT"] });
  runs.push({ sourceKey: adapter.sourceKey, parserVersion: adapter.parserVersion, first: first.counts, replay: replay.counts });
}

const sharedUpcProductIds = new Set(
  repository.identifiers
    .filter((identifier) => identifier.kind === "UPC" && identifier.valueNormalized === "634482541333")
    .map((identifier) => identifier.productId)
);

console.log(JSON.stringify({
  runs,
  products: repository.products.size,
  listings: repository.listings.size,
  identifiers: repository.identifiers.length,
  observations: repository.observations.size,
  exactCrossRetailerUpc: { value: "634482541333", canonicalProductCount: sharedUpcProductIds.size }
}, null, 2));
