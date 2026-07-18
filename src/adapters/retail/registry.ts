import type { AppEnv } from "@/config/env";
import type { RetailDiscoveryAdapter } from "@/domain/adapters";
import { MeijerAdapter } from "./meijer";
import { NecaAdapter } from "./neca";
import { ConfiguredOnlineRetailerAdapter } from "./online";
import { createTargetAdapter } from "./target";
import { WalmartAdapter } from "./walmart";

export function createRetailAdapterRegistry(env: AppEnv): ReadonlyMap<string, RetailDiscoveryAdapter> {
  const specialistMode = env.NODE_ENV !== "production" && env.FIXTURE_INGESTION_ENABLED ? "fixture" : "unavailable";
  return new Map<string, RetailDiscoveryAdapter>([
    ["target", createTargetAdapter(env)],
    ["walmart", new WalmartAdapter(specialistMode)],
    ["meijer", new MeijerAdapter(specialistMode)],
    ["neca", new NecaAdapter(specialistMode)],
    ["online", new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: specialistMode })]
  ]);
}
