import { describe, expect, it } from "vitest";
import { MeijerAdapter, parseMeijerPayload } from "@/adapters/retail/meijer";
import { NecaAdapter, parseNecaPayload } from "@/adapters/retail/neca";
import { ConfiguredOnlineRetailerAdapter, parseOnlineRetailerPayload } from "@/adapters/retail/online";
import type { AdapterSafetyPolicy } from "@/adapters/retail/online/support";
import { createRetailAdapterRegistry } from "@/adapters/retail/registry";
import { WalmartAdapter, parseWalmartPayload } from "@/adapters/retail/walmart";
import { envSchema } from "@/config/env";

const context = { signal: new AbortController().signal, requestId: "retail-contract", now: new Date("2026-07-18T16:30:00.000Z") };
const query = { terms: ["TMNT"], pageLimit: 1 };
const fixtures = [
  new WalmartAdapter("fixture"),
  new MeijerAdapter("fixture"),
  new NecaAdapter("fixture"),
  new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "fixture" })
] as const;

describe("retail adapter shared contract", () => {
  it.each(fixtures)("$sourceKey declares capabilities and emits provenance", async (adapter) => {
    const result = await adapter.discover(query, context);
    expect(adapter.capabilities).toContain("product_discovery");
    expect(adapter.capabilities).toContain("listing_detail");
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.every((item) => item.provenance.sourceKey === adapter.sourceKey)).toBe(true);
      expect(result.items.every((item) => item.provenance.parserVersion.length > 0)).toBe(true);
      expect(result.items.every((item) => item.provenance.rawRef.startsWith("provider:"))).toBe(true);
    }
  });

  it.each([
    new WalmartAdapter("unavailable"), new MeijerAdapter("unavailable"), new NecaAdapter("unavailable"),
    new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "unavailable" })
  ])("$sourceKey reports an unconfigured provider as unavailable", async (adapter) => {
    await expect(adapter.discover(query, context)).resolves.toMatchObject({ kind: "unavailable" });
  });

  it.each(fixtures)("$sourceKey bounds pages, terms, cursors, and aborted requests", async (adapter) => {
    await expect(adapter.discover({ terms: [], pageLimit: 0 }, context)).resolves.toMatchObject({ kind: "malformed" });
    await expect(adapter.discover({ terms: [], pageLimit: 6 }, context)).resolves.toMatchObject({ kind: "malformed" });
    await expect(adapter.discover({ terms: Array.from({ length: 21 }, () => "TMNT"), pageLimit: 1 }, context)).resolves.toMatchObject({ kind: "malformed" });
    await expect(adapter.discover({ terms: [], pageLimit: 1, cursor: "not valid" }, context)).resolves.toMatchObject({ kind: "malformed" });
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.discover(query, { ...context, signal: controller.signal })).resolves.toMatchObject({ kind: "unavailable", reason: "request aborted" });
  });

  it("enforces provider timeout and response-size limits without exposing provider errors", async () => {
    const policy: AdapterSafetyPolicy = { maxPagesPerRequest: 2, requestTimeoutMs: 5, maxResponseBytes: 100, minRequestIntervalMs: 0, retryBackoffSeconds: [1] };
    const hanging = new WalmartAdapter("provider", { discover: () => new Promise(() => undefined) }, policy);
    await expect(hanging.discover(query, context)).resolves.toEqual({ kind: "unavailable", reason: "Walmart approved provider timed out" });
    const oversized = new WalmartAdapter("provider", { discover: async () => ({ kind: "success", fetchedAt: context.now.toISOString(), items: [], padding: "x".repeat(200) }) }, policy);
    await expect(oversized.discover(query, context)).resolves.toMatchObject({ kind: "malformed", rawRef: "redacted:oversize-payload" });
  });

  it.each([
    ["walmart", (payload: unknown) => parseWalmartPayload(payload)],
    ["meijer", (payload: unknown) => parseMeijerPayload(payload)],
    ["neca", (payload: unknown) => parseNecaPayload(payload)],
    ["online", (payload: unknown) => parseOnlineRetailerPayload("bigbadtoystore", payload)]
  ])("%s preserves throttling and malformed provider outcomes", (_source, parse) => {
    expect(parse({ kind: "throttled", retryAfter: "2026-07-18T17:00:00.000Z" })).toEqual({ kind: "throttled", retryAfter: "2026-07-18T17:00:00.000Z" });
    expect(parse({ kind: "success", fetchedAt: "invalid", items: [] })).toMatchObject({ kind: "malformed", rawRef: "redacted:validation-error" });
  });

  it.each([
    ["walmart", (policy: AdapterSafetyPolicy) => new WalmartAdapter("provider", { discover: () => new Promise(() => undefined) }, policy)],
    ["meijer", (policy: AdapterSafetyPolicy) => new MeijerAdapter("provider", { discover: () => new Promise(() => undefined) }, policy)],
    ["neca", (policy: AdapterSafetyPolicy) => new NecaAdapter("provider", { discover: () => new Promise(() => undefined) }, policy)],
    ["online", (policy: AdapterSafetyPolicy) => new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "provider" }, { discover: () => new Promise(() => undefined) }, policy)]
  ])("%s applies the configured provider timeout", async (_source, createAdapter) => {
    const policy: AdapterSafetyPolicy = { maxPagesPerRequest: 2, requestTimeoutMs: 5, maxResponseBytes: 1_000, minRequestIntervalMs: 0, retryBackoffSeconds: [1] };
    await expect(createAdapter(policy).discover(query, context)).resolves.toMatchObject({ kind: "unavailable", reason: expect.stringContaining("timed out") });
  });

  it("registers all sources with fixture mode controlled by the existing fixture flag", async () => {
    const env = envSchema.parse({ NODE_ENV: "test", FIXTURE_INGESTION_ENABLED: "true", TARGET_ADAPTER_MODE: "fixture" });
    const registry = createRetailAdapterRegistry(env);
    expect([...registry.keys()]).toEqual(["target", "walmart", "meijer", "neca", "online"]);
    await expect(registry.get("walmart")?.discover(query, context)).resolves.toMatchObject({ kind: "success" });
    const production = createRetailAdapterRegistry(envSchema.parse({ NODE_ENV: "production", FIXTURE_INGESTION_ENABLED: "true", TARGET_ADAPTER_MODE: "unavailable" }));
    await expect(production.get("walmart")?.discover(query, context)).resolves.toMatchObject({ kind: "unavailable" });
  });

  it("honors each source mode without turning unavailable into out of stock", async () => {
    const registry = createRetailAdapterRegistry(envSchema.parse({
      NODE_ENV: "test",
      FIXTURE_INGESTION_ENABLED: "true",
      LIVE_INGESTION_ENABLED: "true",
      TARGET_ADAPTER_MODE: "fixture",
      WALMART_ADAPTER_MODE: "unavailable",
      MEIJER_ADAPTER_MODE: "fixture",
      NECA_ADAPTER_MODE: "provider",
      ONLINE_RETAIL_ADAPTER_MODE: "unavailable"
    }));

    await expect(registry.get("walmart")?.discover(query, context)).resolves.toMatchObject({ kind: "unavailable" });
    await expect(registry.get("meijer")?.discover(query, context)).resolves.toMatchObject({ kind: "success" });
    await expect(registry.get("neca")?.discover(query, context)).resolves.toMatchObject({ kind: "unavailable" });
    await expect(registry.get("online")?.discover(query, context)).resolves.toMatchObject({ kind: "unavailable" });
  });
});
