import fixturePage from "../../../tests/fixtures/crowd/reddit/posts.json";
import type { AppEnv } from "@/config/env";
import type { CrowdSourceAdapter } from "@/domain/adapters";
import { RedditCrowdAdapter, type RedditApprovedAccessClient } from "./reddit";
import { RedditRssClient } from "./reddit/rss-client";

export function createCrowdAdapterRegistry(
  env: AppEnv,
  approvedRedditClient?: RedditApprovedAccessClient
): ReadonlyMap<string, CrowdSourceAdapter> {
  const communities = env.REDDIT_COMMUNITIES.split(",").map((community) => community.trim()).filter(Boolean);
  const publicRssClient = env.REDDIT_ADAPTER_MODE === "rss" && env.LIVE_INGESTION_ENABLED
    ? new RedditRssClient({
      userAgent: env.REDDIT_USER_AGENT,
      requestTimeoutMs: env.ADAPTER_REQUEST_TIMEOUT_MS,
      minRequestIntervalMs: env.ADAPTER_MIN_REQUEST_INTERVAL_MS
    })
    : undefined;
  const client = approvedRedditClient ?? publicRssClient;
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
