import type { AppEnv } from "@/config/env";

export const SOURCE_KEYS = ["target", "walmart", "meijer", "neca", "online", "reddit"] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];
export type SourceState = "live" | "fixture-only" | "pending-sanctioned-access" | "unavailable";

const pendingSanctionedAccess = new Set<SourceKey>(["target", "walmart", "meijer"]);

const labels: Record<SourceKey, string> = {
  target: "Target",
  walmart: "Walmart",
  meijer: "Meijer",
  neca: "NECA",
  online: "BigBadToyStore",
  reddit: "Reddit / Ross Finds"
};
const capabilities: Record<SourceKey, readonly string[]> = {
  target: ["product discovery", "listing detail", "store availability"],
  walmart: ["product discovery", "listing detail", "store availability"],
  meijer: ["product discovery", "listing detail", "store availability"],
  neca: ["product discovery", "listing detail"],
  online: ["product discovery", "listing detail"],
  reddit: ["crowd posts"]
};

export function sourceStateFor(env: AppEnv, key: SourceKey): SourceState {
  const mode = ({
    target: env.TARGET_ADAPTER_MODE,
    walmart: env.WALMART_ADAPTER_MODE,
    meijer: env.MEIJER_ADAPTER_MODE,
    neca: env.NECA_ADAPTER_MODE,
    online: env.ONLINE_RETAIL_ADAPTER_MODE,
    reddit: env.REDDIT_ADAPTER_MODE
  } as const)[key];
  if (mode === "fixture" && env.FIXTURE_INGESTION_ENABLED && (env.NODE_ENV !== "production" || env.SHELF_RADAR_DATA_MODE === "fixture")) return "fixture-only";
  if (pendingSanctionedAccess.has(key)) return "pending-sanctioned-access";
  if (env.SHELF_RADAR_DATA_MODE === "database" && env.LIVE_INGESTION_ENABLED) {
    if (key === "neca" && mode === "public") return "live";
  }
  return "unavailable";
}

export function buildSourceMatrix(env: AppEnv): Array<{ key: SourceKey; label: string; state: SourceState; note: string; capabilities: readonly string[] }> {
  return SOURCE_KEYS.map((key) => {
    // The owner-facing matrix describes production access, even while local
    // fixture contracts remain runnable for parser and UI verification.
    const state = pendingSanctionedAccess.has(key) ? "pending-sanctioned-access" : sourceStateFor(env, key);
    return {
      key,
      label: labels[key],
      capabilities: capabilities[key],
      state,
      note: state === "fixture-only"
        ? "Deterministic synthetic data; no live request"
        : state === "pending-sanctioned-access"
          ? "No approved store-level feed is connected. Manual field checks and official retailer search shortcuts are active while access is pursued."
        : state === "live" && key === "neca"
          ? "Read-only product and online offer signals from the official NECA Store catalog"
          : key === "reddit"
            ? "Automated Reddit access is blocked pending explicit Reddit approval; cached sightings remain readable and stale"
            : "No approved live connector is active; cached records remain readable"
    };
  });
}
