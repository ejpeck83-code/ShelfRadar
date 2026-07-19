import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
describe("environment safety", () => {
  it("allows fixture-only development without credentials", () => { expect(envSchema.parse({}).TARGET_ADAPTER_MODE).toBe("fixture"); });
  it("rejects provider mode without both flag and credentials", () => { expect(() => envSchema.parse({ TARGET_ADAPTER_MODE: "provider", LIVE_INGESTION_ENABLED: "false" })).toThrow(); });
  it.each(["WALMART_ADAPTER_MODE", "MEIJER_ADAPTER_MODE", "NECA_ADAPTER_MODE", "ONLINE_RETAIL_ADAPTER_MODE"] as const)("requires live ingestion for %s", (key) => {
    expect(() => envSchema.parse({ [key]: "provider", LIVE_INGESTION_ENABLED: "false" })).toThrow();
  });
  it("rejects unauthenticated production database mode", () => { expect(() => envSchema.parse({ NODE_ENV: "production", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test", AUTH_MODE: "development" })).toThrow(); });
  it("requires long owner and job secrets for production database mode", () => {
    const base = { NODE_ENV: "production", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test", AUTH_MODE: "shared-secret", ALLOWED_USER_EMAIL: "owner@example.com" };
    expect(() => envSchema.parse(base)).toThrow();
    expect(envSchema.parse({ ...base, AUTH_SECRET: "a".repeat(32), CRON_SECRET: "b".repeat(32) })).toMatchObject({ AUTH_MODE: "shared-secret" });
  });
  it("rejects private or credential-bearing provider endpoints", () => {
    const base = { TARGET_ADAPTER_MODE: "provider", LIVE_INGESTION_ENABLED: "true", TARGET_PROVIDER_API_KEY: "synthetic-key" };
    expect(() => envSchema.parse({ ...base, TARGET_PROVIDER_BASE_URL: "http://127.0.0.1/internal" })).toThrow();
    expect(() => envSchema.parse({ ...base, TARGET_PROVIDER_BASE_URL: "https://user:pass@provider.example/api" })).toThrow();
  });
});
