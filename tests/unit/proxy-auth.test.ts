import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

afterEach(() => vi.unstubAllEnvs());

describe("production owner proxy", () => {
  it("redirects page requests to login while leaving job routes to bearer authentication", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHELF_RADAR_DATA_MODE", "database");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@db.example/shelf_radar");
    vi.stubEnv("AUTH_MODE", "shared-secret");
    vi.stubEnv("AUTH_SECRET", "owner-secret-that-is-at-least-32-characters");
    vi.stubEnv("ALLOWED_USER_EMAIL", "owner@example.com");
    vi.stubEnv("CRON_SECRET", "cron-secret-that-is-at-least-32-characters");
    vi.stubEnv("APP_BASE_URL", "https://shelf.example");

    const pageResponse = await proxy(new NextRequest("https://shelf.example/products/00000000-0000-0000-0000-000000000001", { headers: { accept: "text/html" } }));
    const apiResponse = await proxy(new NextRequest("https://shelf.example/api/products/00000000-0000-0000-0000-000000000001/state", { method: "POST" }));
    expect(pageResponse.status).toBe(307);
    expect(pageResponse.headers.get("location")).toBe("https://shelf.example/login?next=%2Fproducts%2F00000000-0000-0000-0000-000000000001");
    expect(apiResponse.status).toBe(401);
    expect((await proxy(new NextRequest("https://shelf.example/api/jobs/ingest/target"))).status).toBe(200);
    expect(config.matcher[0]).not.toContain("products/");
  });
});
