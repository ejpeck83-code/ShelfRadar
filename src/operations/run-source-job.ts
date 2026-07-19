import type { AppEnv } from "@/config/env";
import type { ShelfRadarDb } from "@/db/client";
import { PostgresCatalogRepository } from "@/db/repositories/postgres-catalog";
import { createRetailAdapterRegistry } from "@/adapters/retail/registry";
import { createCrowdAdapterRegistry } from "@/adapters/crowd/registry";
import { PostgresCrowdSightingRepository } from "@/features/sightings/parser/persistence";
import { buildRedditQueryTerms, DEFAULT_CROWD_TERMS } from "@/features/sightings/parser";
import { runCrowdDiscovery } from "@/ingestion/run-crowd-discovery";
import { runDiscovery } from "@/ingestion/run-discovery";
import type { SourceKey } from "@/features/sources/status";

export async function runRegisteredSourceJob(input: { env: AppEnv; db: ShelfRadarDb; sourceKey: SourceKey; now: Date; runKey: string }) {
  if (input.sourceKey === "reddit") {
    const adapter = createCrowdAdapterRegistry(input.env).get("reddit");
    if (!adapter) throw new Error("Reddit adapter is not registered");
    return runCrowdDiscovery({
      adapter,
      repository: new PostgresCrowdSightingRepository(input.db),
      now: input.now,
      runKey: input.runKey,
      terms: DEFAULT_CROWD_TERMS,
      queryTerms: buildRedditQueryTerms(DEFAULT_CROWD_TERMS),
      pageLimit: input.env.ADAPTER_MAX_PAGES_PER_RUN
    });
  }
  const adapter = createRetailAdapterRegistry(input.env).get(input.sourceKey);
  if (!adapter) throw new Error("Retail adapter is not registered");
  return runDiscovery({
    adapter,
    repository: new PostgresCatalogRepository(input.db),
    now: input.now,
    runKey: input.runKey,
    terms: input.env.TMNT_DISCOVERY_TERMS.split(",").map((term) => term.trim()).filter(Boolean),
    pageLimit: input.env.ADAPTER_MAX_PAGES_PER_RUN
  });
}

export function scheduledRunKey(sourceKey: SourceKey, now: Date): string {
  return `scheduled:${sourceKey}:${now.toISOString().slice(0, 16)}`;
}
