import { describe, expect, it } from "vitest";
import { createCrowdAdapterRegistry } from "@/adapters/crowd/registry";
import { envSchema } from "@/config/env";

const context = { signal: new AbortController().signal, requestId: "crowd-registry", now: new Date("2026-07-18T18:00:00.000Z") };

describe("crowd adapter registry", () => {
  it("requires explicit live enablement and approved OAuth configuration", () => {
    expect(() => envSchema.parse({ REDDIT_ADAPTER_MODE: "oauth" })).toThrow();
    expect(() => envSchema.parse({ REDDIT_ADAPTER_MODE: "oauth", LIVE_INGESTION_ENABLED: "true" })).toThrow();
  });

  it("runs fixtures only when fixture ingestion is enabled", async () => {
    const fixture = createCrowdAdapterRegistry(envSchema.parse({ NODE_ENV: "test", REDDIT_ADAPTER_MODE: "fixture", FIXTURE_INGESTION_ENABLED: "true" }));
    await expect(fixture.get("reddit")?.fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context)).resolves.toMatchObject({ kind: "success" });

    const disabled = createCrowdAdapterRegistry(envSchema.parse({ NODE_ENV: "test", REDDIT_ADAPTER_MODE: "fixture", FIXTURE_INGESTION_ENABLED: "false" }));
    await expect(disabled.get("reddit")?.fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context)).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("keeps configured OAuth unavailable until an approved client is injected", async () => {
    const env = envSchema.parse({
      NODE_ENV: "production",
      REDDIT_ADAPTER_MODE: "oauth",
      LIVE_INGESTION_ENABLED: "true",
      REDDIT_CLIENT_ID: "synthetic-client",
      REDDIT_CLIENT_SECRET: "synthetic-secret",
      REDDIT_REFRESH_TOKEN: "synthetic-refresh",
      REDDIT_USER_AGENT: "shelf-radar-tests"
    });
    const registry = createCrowdAdapterRegistry(env);
    await expect(registry.get("reddit")?.fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context)).resolves.toMatchObject({ kind: "unavailable" });
  });
});
