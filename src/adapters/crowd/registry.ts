import fixturePage from "../../../tests/fixtures/crowd/reddit/posts.json";
import type { AppEnv } from "@/config/env";
import type { CrowdSourceAdapter } from "@/domain/adapters";
import { RedditCrowdAdapter, type RedditApprovedAccessClient } from "./reddit";

export function createCrowdAdapterRegistry(
  env: AppEnv,
  approvedRedditClient?: RedditApprovedAccessClient
): ReadonlyMap<string, CrowdSourceAdapter> {
  const communities = env.REDDIT_COMMUNITIES.split(",").map((community) => community.trim()).filter(Boolean);
  // Reddit's current Responsible Builder Policy requires explicit approval for
  // automated access. A transport is composed only when approved access is
  // injected by the owner; environment flags alone cannot activate public RSS.
  const client = approvedRedditClient;
  const mode = effectiveRedditMode(env, client);
  const adapter = new RedditCrowdAdapter({
    mode,
    communities,
    ...(mode === "fixture" ? { fixturePages: [fixturePage] } : {}),
    ...(client ? { client } : {}),
    maxPagesPerRun: env.ADAPTER_MAX_PAGES_PER_RUN,
    requestTimeoutMs: env.ADAPTER_REQUEST_TIMEOUT_MS
  });
  return new Map([[adapter.sourceKey, adapter]]);
}

function effectiveRedditMode(env: AppEnv, approvedClient: RedditApprovedAccessClient | undefined): "fixture" | "unavailable" | "oauth" | "rss" {
  if (env.REDDIT_ADAPTER_MODE === "fixture") {
    return env.NODE_ENV !== "production" && env.FIXTURE_INGESTION_ENABLED ? "fixture" : "unavailable";
  }
  if (env.REDDIT_ADAPTER_MODE === "oauth") {
    return env.LIVE_INGESTION_ENABLED && approvedClient ? "oauth" : "unavailable";
  }
  if (env.REDDIT_ADAPTER_MODE === "rss") {
    return env.LIVE_INGESTION_ENABLED && approvedClient ? "rss" : "unavailable";
  }
  return "unavailable";
}
