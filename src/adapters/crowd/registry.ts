import fixturePage from "../../../tests/fixtures/crowd/reddit/posts.json";
import type { AppEnv } from "@/config/env";
import type { CrowdSourceAdapter } from "@/domain/adapters";
import { RedditCrowdAdapter, type RedditApprovedAccessClient } from "./reddit";

export function createCrowdAdapterRegistry(
  env: AppEnv,
  approvedRedditClient?: RedditApprovedAccessClient
): ReadonlyMap<string, CrowdSourceAdapter> {
  const communities = env.REDDIT_COMMUNITIES.split(",").map((community) => community.trim()).filter(Boolean);
  const mode = effectiveRedditMode(env, approvedRedditClient);
  const adapter = new RedditCrowdAdapter({
    mode,
    communities,
    ...(mode === "fixture" ? { fixturePages: [fixturePage] } : {}),
    ...(approvedRedditClient ? { client: approvedRedditClient } : {}),
    maxPagesPerRun: env.ADAPTER_MAX_PAGES_PER_RUN,
    requestTimeoutMs: env.ADAPTER_REQUEST_TIMEOUT_MS
  });
  return new Map([[adapter.sourceKey, adapter]]);
}

function effectiveRedditMode(env: AppEnv, approvedClient: RedditApprovedAccessClient | undefined): "fixture" | "unavailable" | "oauth" {
  if (env.REDDIT_ADAPTER_MODE === "fixture") {
    return env.NODE_ENV !== "production" && env.FIXTURE_INGESTION_ENABLED ? "fixture" : "unavailable";
  }
  if (env.REDDIT_ADAPTER_MODE === "oauth") {
    return env.LIVE_INGESTION_ENABLED && approvedClient ? "oauth" : "unavailable";
  }
  return "unavailable";
}
