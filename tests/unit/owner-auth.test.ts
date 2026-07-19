import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
import { createOwnerSessionToken, isAuthorizedJob, isAuthorizedOwner, isSameOriginMutation, OWNER_SESSION_COOKIE } from "@/security/owner-auth";

describe("owner mutation authorization", () => {
  it("allows the local mock owner only outside production", async () => {
    const request = new Request("http://localhost:3000/api/state", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } });
    await expect(isAuthorizedOwner(request, envSchema.parse({ NODE_ENV: "development" }))).resolves.toBe(true);
    expect(isSameOriginMutation(request)).toBe(true);
  });
  it("uses the actual request origin for non-production hosts", () => {
    const request = new Request("http://127.0.0.1:3000/api/state", { method: "POST", headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000", "sec-fetch-site": "same-origin" } });
    expect(isSameOriginMutation(request, envSchema.parse({ NODE_ENV: "development" }))).toBe(true);
  });
  it("requires shared-secret owner credentials and the configured origin", async () => {
    const secret = "release-owner-secret-that-is-long-enough";
    const env = envSchema.parse({ NODE_ENV: "production", AUTH_MODE: "shared-secret", AUTH_SECRET: secret, CRON_SECRET: "release-cron-secret-that-is-long-enough", ALLOWED_USER_EMAIL: "owner@example.com", APP_BASE_URL: "https://shelf.example", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test" });
    const authorization = `Basic ${Buffer.from(`owner@example.com:${secret}`).toString("base64")}`;
    const owner = new Request("https://shelf.example/api/state", { method: "POST", headers: { origin: "https://shelf.example", authorization } });
    const attacker = new Request("https://shelf.example/api/state", { method: "POST", headers: { origin: "https://evil.example", authorization } });
    await expect(isAuthorizedOwner(owner, env)).resolves.toBe(true); expect(isSameOriginMutation(owner, env)).toBe(true);
    await expect(isAuthorizedOwner(attacker, env)).resolves.toBe(true); expect(isSameOriginMutation(attacker, env)).toBe(false);
  });
  it("accepts a signed remembered-owner session cookie", async () => {
    const env = envSchema.parse({ NODE_ENV: "production", AUTH_MODE: "shared-secret", AUTH_SECRET: "release-owner-secret-that-is-long-enough", CRON_SECRET: "release-cron-secret-that-is-long-enough", ALLOWED_USER_EMAIL: "ejpeck83", APP_BASE_URL: "https://shelf.example", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test" });
    const token = await createOwnerSessionToken(env);
    const request = new Request("https://shelf.example/discover", { headers: { cookie: `${OWNER_SESSION_COOKIE}=${token}` } });
    await expect(isAuthorizedOwner(request, env)).resolves.toBe(true);
  });
  it("accepts only a cookie-free bearer job secret", () => {
    const env = envSchema.parse({ CRON_SECRET: "release-cron-secret-that-is-long-enough" });
    const headers = { authorization: "Bearer release-cron-secret-that-is-long-enough" };
    expect(isAuthorizedJob(new Request("http://localhost/api/jobs/ingest", { method: "POST", headers }), env)).toBe(true);
    expect(isAuthorizedJob(new Request("http://localhost/api/jobs/ingest", { method: "GET", headers }), env)).toBe(true);
    expect(isAuthorizedJob(new Request("http://localhost/api/jobs/ingest", { method: "POST", headers: { ...headers, cookie: "session=browser" } }), env)).toBe(false);
    expect(isAuthorizedJob(new Request("http://localhost/api/jobs/ingest", { method: "PUT", headers }), env)).toBe(false);
  });
});
