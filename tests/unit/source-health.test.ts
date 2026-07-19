import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
import { buildSourceMatrix, sourceStateFor } from "@/features/sources/status";
import { createRetailAdapterRegistry } from "@/adapters/retail/registry";
import { createCrowdAdapterRegistry } from "@/adapters/crowd/registry";

describe("source health matrix", () => {
  it("labels fixture sources without claiming live access", () => {
    const env = envSchema.parse({ NODE_ENV: "test", FIXTURE_INGESTION_ENABLED: "true" });
    expect(buildSourceMatrix(env).every((source) => source.state === "fixture-only")).toBe(true);
  });

  it("labels a production fixture preview as synthetic while keeping production database sources unavailable", () => {
    const preview = envSchema.parse({ NODE_ENV: "production", SHELF_RADAR_DATA_MODE: "fixture", FIXTURE_INGESTION_ENABLED: "true" });
    expect(buildSourceMatrix(preview).every((source) => source.state === "fixture-only")).toBe(true);
    const database = envSchema.parse({ NODE_ENV: "production", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://example.invalid/shelf_radar", AUTH_MODE: "shared-secret", AUTH_SECRET: "a".repeat(32), ALLOWED_USER_EMAIL: "owner@example.com", CRON_SECRET: "b".repeat(32), FIXTURE_INGESTION_ENABLED: "true" });
    expect(buildSourceMatrix(database).every((source) => source.state === "unavailable")).toBe(true);
  });

  it("can fail each source independently and all sources together", () => {
    const keys = ["target", "walmart", "meijer", "neca", "online", "reddit"] as const;
    for (const key of keys) {
      const variable = ({ target: "TARGET_ADAPTER_MODE", walmart: "WALMART_ADAPTER_MODE", meijer: "MEIJER_ADAPTER_MODE", neca: "NECA_ADAPTER_MODE", online: "ONLINE_RETAIL_ADAPTER_MODE", reddit: "REDDIT_ADAPTER_MODE" } as const)[key];
      const env = envSchema.parse({ NODE_ENV: "test", [variable]: "unavailable" });
      expect(sourceStateFor(env, key)).toBe("unavailable");
      expect(keys.filter((other) => other !== key).every((other) => sourceStateFor(env, other) === "fixture-only")).toBe(true);
    }
    const unavailable = envSchema.parse({ NODE_ENV: "test", TARGET_ADAPTER_MODE: "unavailable", WALMART_ADAPTER_MODE: "unavailable", MEIJER_ADAPTER_MODE: "unavailable", NECA_ADAPTER_MODE: "unavailable", ONLINE_RETAIL_ADAPTER_MODE: "unavailable", REDDIT_ADAPTER_MODE: "unavailable" });
    expect(buildSourceMatrix(unavailable).every((source) => source.state === "unavailable")).toBe(true);
  });

  it("returns structured unavailable outcomes when every source fails together", async () => {
    const env = envSchema.parse({ NODE_ENV: "test", TARGET_ADAPTER_MODE: "unavailable", WALMART_ADAPTER_MODE: "unavailable", MEIJER_ADAPTER_MODE: "unavailable", NECA_ADAPTER_MODE: "unavailable", ONLINE_RETAIL_ADAPTER_MODE: "unavailable", REDDIT_ADAPTER_MODE: "unavailable" });
    const context = { signal: new AbortController().signal, requestId: "all-unavailable", now: new Date("2026-07-18T20:00:00.000Z") };
    const retail = await Promise.all([...createRetailAdapterRegistry(env).values()].map((adapter) => adapter.discover({ terms: ["TMNT"], pageLimit: 1 }, context)));
    const crowd = await createCrowdAdapterRegistry(env).get("reddit")?.fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context);
    expect(retail.every((result) => result.kind === "unavailable")).toBe(true);
    expect(crowd).toMatchObject({ kind: "unavailable" });
  });
});
