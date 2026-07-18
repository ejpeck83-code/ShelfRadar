import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
describe("environment safety", () => {
  it("allows fixture-only development without credentials", () => { expect(envSchema.parse({}).TARGET_ADAPTER_MODE).toBe("fixture"); });
  it("rejects provider mode without both flag and credentials", () => { expect(() => envSchema.parse({ TARGET_ADAPTER_MODE: "provider", LIVE_INGESTION_ENABLED: "false" })).toThrow(); });
  it("rejects unauthenticated production database mode", () => { expect(() => envSchema.parse({ NODE_ENV: "production", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test", AUTH_MODE: "development" })).toThrow(); });
});
