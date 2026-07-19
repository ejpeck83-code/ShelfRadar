import type { AppEnv } from "@/config/env";
import type { RetailDiscoveryAdapter } from "@/domain/adapters";
import { MeijerAdapter } from "./meijer";
import { NecaAdapter } from "./neca";
import { ConfiguredOnlineRetailerAdapter } from "./online";
import { createTargetAdapter } from "./target";
import { WalmartAdapter } from "./walmart";

export function createRetailAdapterRegistry(env: AppEnv): ReadonlyMap<string, RetailDiscoveryAdapter> {
  const sourceMode = (configured: "fixture" | "unavailable" | "provider") => {
    if (env.NODE_ENV === "production") return "unavailable" as const;
    if (configured === "fixture" && !env.FIXTURE_INGESTION_ENABLED) return "unavailable" as const;
    return configured;
  };
  return new Map<string, RetailDiscoveryAdapter>([
    ["target", createTargetAdapter({ ...env, TARGET_ADAPTER_MODE: sourceMode(env.TARGET_ADAPTER_MODE) })],
    ["walmart", new WalmartAdapter(sourceMode(env.WALMART_ADAPTER_MODE))],
    ["meijer", new MeijerAdapter(sourceMode(env.MEIJER_ADAPTER_MODE))],
    ["neca", new NecaAdapter(sourceMode(env.NECA_ADAPTER_MODE))],
    ["online", new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: sourceMode(env.ONLINE_RETAIL_ADAPTER_MODE) })]
  ]);
}
