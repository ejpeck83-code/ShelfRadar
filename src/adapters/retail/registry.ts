import type { AppEnv } from "@/config/env";
import type { RetailDiscoveryAdapter } from "@/domain/adapters";
import { createTargetAdapter } from "./target";
import { UnavailableRetailAdapter } from "./unavailable";

export function createRetailAdapterRegistry(env: AppEnv): ReadonlyMap<string, RetailDiscoveryAdapter> {
  const unavailable = (key: string, label: string) => new UnavailableRetailAdapter(key, ["product_discovery", "listing_detail"], `${label} connector is not implemented in the Target milestone`);
  return new Map<string, RetailDiscoveryAdapter>([
    ["target", createTargetAdapter(env)],
    ["walmart", unavailable("walmart", "Walmart")],
    ["meijer", unavailable("meijer", "Meijer")],
    ["neca", unavailable("neca", "NECA")],
    ["online", unavailable("online", "Online retailer")]
  ]);
}
