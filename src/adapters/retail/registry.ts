import type { AppEnv } from "@/config/env";
import type { RetailDiscoveryAdapter } from "@/domain/adapters";
import { MeijerAdapter } from "./meijer";
import { NecaAdapter } from "./neca";
import { NecaStorefrontProvider } from "./neca/storefront-client";
import { ConfiguredOnlineRetailerAdapter } from "./online";
import { createTargetAdapter } from "./target";
import { WalmartAdapter } from "./walmart";

export function createRetailAdapterRegistry(env: AppEnv): ReadonlyMap<string, RetailDiscoveryAdapter> {
  const sourceMode = (configured: "fixture" | "unavailable" | "provider") => {
    if (env.NODE_ENV === "production") return "unavailable" as const;
    if (configured === "fixture" && !env.FIXTURE_INGESTION_ENABLED) return "unavailable" as const;
    return configured;
  };
  const necaPublic = env.NECA_ADAPTER_MODE === "public" && env.LIVE_INGESTION_ENABLED;
  const necaMode = necaPublic ? "provider" : env.NECA_ADAPTER_MODE === "public" ? "unavailable" : sourceMode(env.NECA_ADAPTER_MODE);
  const necaProvider = necaPublic ? new NecaStorefrontProvider({
    requestTimeoutMs: env.ADAPTER_REQUEST_TIMEOUT_MS,
    minRequestIntervalMs: env.ADAPTER_MIN_REQUEST_INTERVAL_MS
  }) : undefined;
  return new Map<string, RetailDiscoveryAdapter>([
    ["target", createTargetAdapter({ ...env, TARGET_ADAPTER_MODE: sourceMode(env.TARGET_ADAPTER_MODE) })],
    ["walmart", new WalmartAdapter(sourceMode(env.WALMART_ADAPTER_MODE))],
    ["meijer", new MeijerAdapter(sourceMode(env.MEIJER_ADAPTER_MODE))],
    ["neca", new NecaAdapter(necaMode, necaProvider)],
    ["online", new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: sourceMode(env.ONLINE_RETAIL_ADAPTER_MODE) })]
  ]);
}
