import { describe, expect, it } from "vitest";
import { envSchema } from "@/config/env";
import { isAuthorizedOwner, isSameOriginMutation } from "@/security/owner-auth";

describe("owner mutation authorization", () => {
  it("allows the local mock owner only outside production", () => {
    const request = new Request("http://localhost:3000/api/state", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" } });
    expect(isAuthorizedOwner(request, envSchema.parse({ NODE_ENV: "development" }))).toBe(true);
    expect(isSameOriginMutation(request)).toBe(true);
  });
  it("requires the allowlisted platform identity and same origin", () => {
    const env = envSchema.parse({ NODE_ENV: "production", AUTH_MODE: "platform", ALLOWED_USER_EMAIL: "owner@example.com", SHELF_RADAR_DATA_MODE: "database", DATABASE_URL: "postgresql://user:pass@db/test" });
    const owner = new Request("https://shelf.example/api/state", { method: "POST", headers: { origin: "https://shelf.example", host: "shelf.example", "x-shelf-radar-user-email": "owner@example.com" } });
    const attacker = new Request("https://shelf.example/api/state", { method: "POST", headers: { origin: "https://evil.example", host: "shelf.example", "x-shelf-radar-user-email": "other@example.com" } });
    expect(isAuthorizedOwner(owner, env)).toBe(true); expect(isSameOriginMutation(owner)).toBe(true);
    expect(isAuthorizedOwner(attacker, env)).toBe(false); expect(isSameOriginMutation(attacker)).toBe(false);
  });
});
