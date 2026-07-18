import { TargetAdapter } from "../src/adapters/retail/target";
import { MemoryCatalogRepository } from "../src/db/repositories/memory-catalog";
import { runDiscovery } from "../src/ingestion/run-discovery";

const repository = new MemoryCatalogRepository();
const adapter = new TargetAdapter("fixture");
const now = new Date("2026-07-18T16:00:00.000Z");
const first = await runDiscovery({ adapter, repository, now, runKey: "fixture-demo:first", terms: ["TMNT"] });
const replay = await runDiscovery({ adapter, repository, now, runKey: "fixture-demo:replay", terms: ["TMNT"] });
console.log(JSON.stringify({ first: first.counts, replay: replay.counts, products: repository.products.size, listings: repository.listings.size, observations: repository.observations.size }, null, 2));
