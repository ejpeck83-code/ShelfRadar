import { describe, expect, it } from "vitest";
import changedWalmartPrice from "../fixtures/retail/walmart/changed-price.json";
import removedWalmart from "../fixtures/retail/walmart/removed.json";
import unavailableWalmart from "../fixtures/retail/walmart/unavailable.json";
import malformedMeijer from "../fixtures/retail/meijer/malformed.json";
import throttledMeijer from "../fixtures/retail/meijer/throttled.json";
import removedNeca from "../fixtures/retail/neca/removed.json";
import { MeijerAdapter, parseMeijerPayload } from "@/adapters/retail/meijer";
import { NecaAdapter, parseNecaPayload } from "@/adapters/retail/neca";
import { ConfiguredOnlineRetailerAdapter, parseOnlineRetailerPayload } from "@/adapters/retail/online";
import { WalmartAdapter, parseWalmartPayload } from "@/adapters/retail/walmart";

const context = { signal: new AbortController().signal, requestId: "source-test", now: new Date("2026-07-18T16:30:00.000Z") };
const query = { terms: ["TMNT"], pageLimit: 1 };

describe("Walmart parsing", () => {
  it("normalizes GTINs and keeps item IDs in the Walmart namespace", async () => {
    const result = await new WalmartAdapter("fixture").discover(query, context);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.nextCursor).toBe("page-2");
      expect(result.items[0]?.identifiers).toEqual(expect.arrayContaining([
        { kind: "WALMART_ITEM_ID", value: "147258369", confidence: "EXACT" },
        { kind: "UPC", value: "634482541333", confidence: "EXACT" }
      ]));
      expect(result.items[1]?.identifiers).toContainEqual({ kind: "GTIN13", value: "0123456789012", confidence: "EXACT" });
      expect(result.items[0]).not.toHaveProperty("itemId");
    }
  });
  it("represents changed prices and removed listings", () => {
    expect(parseWalmartPayload(changedWalmartPrice)).toMatchObject({ kind: "success", items: [{ priceMinor: 3299 }] });
    expect(parseWalmartPayload(removedWalmart)).toMatchObject({ kind: "success", items: [{ listingStatus: "REMOVED" }] });
    expect(parseWalmartPayload(unavailableWalmart)).toEqual({ kind: "unavailable", reason: "Approved provider maintenance window; cached data remains visible", retryAfter: "2026-07-18T17:00:00.000Z" });
  });
  it("supports adapter-local listing detail", async () => {
    const result = await new WalmartAdapter("fixture").fetchListing({ externalId: "147258369" }, context);
    expect(result).toMatchObject({ kind: "success", items: [{ externalId: "147258369" }] });
  });
});

describe("Meijer parsing", () => {
  it("namespaces SKUs, omits a missing UPC, and reports weak availability as unknown", async () => {
    const result = await new MeijerAdapter("fixture").discover(query, context);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.items[0]?.identifiers[0]).toEqual({ kind: "MEIJER_SKU", value: "MEI-901245", confidence: "EXACT" });
      expect(result.items[0]?.identifiers).toContainEqual({ kind: "UPC", value: "012345678905", confidence: "EXACT" });
      expect(result.items[0]?.availability[0]?.status).toBe("UNKNOWN");
      expect(result.items[1]?.identifiers).toEqual([{ kind: "MEIJER_SKU", value: "MEI-901246", confidence: "EXACT" }]);
      expect(result.items[1]?.availability).toEqual([]);
    }
  });
  it("preserves throttling metadata and rejects malformed payloads", () => {
    expect(parseMeijerPayload(throttledMeijer)).toEqual({ kind: "throttled", retryAfter: "2026-07-18T16:15:00.000Z" });
    expect(parseMeijerPayload(malformedMeijer)).toMatchObject({ kind: "malformed", rawRef: "redacted:validation-error" });
  });
  it("supports adapter-local listing detail", async () => {
    const result = await new MeijerAdapter("fixture").fetchListing({ externalId: "MEI-901245" }, context);
    expect(result).toMatchObject({ kind: "success", items: [{ externalId: "MEI-901245" }] });
  });
});

describe("NECA and allowlisted online parsing", () => {
  it("uses online-only/preorder semantics and manufacturer identifiers for NECA", async () => {
    const result = await new NecaAdapter("fixture").discover(query, context);
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.items[0]?.listingStatus).toBe("PREORDER");
      expect(result.items[0]?.availability[0]?.status).toBe("PREORDER");
      expect(result.items[1]?.availability[0]?.status).toBe("ONLINE_ONLY");
      expect(result.items[0]?.identifiers).toContainEqual({ kind: "MANUFACTURER_SKU", value: "54210", confidence: "CLAIMED" });
    }
    expect(parseNecaPayload(removedNeca)).toMatchObject({ kind: "success", items: [{ listingStatus: "REMOVED", availability: [{ status: "UNKNOWN" }] }] });
  });
  it("accepts only the selected online retailer host", async () => {
    const adapter = new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "fixture" });
    await expect(adapter.discover(query, context)).resolves.toMatchObject({ kind: "success", items: [{ listingStatus: "PREORDER", availability: [{ status: "PREORDER" }] }] });
    expect(parseOnlineRetailerPayload("bigbadtoystore", {
      kind: "success", fetchedAt: context.now.toISOString(),
      items: [{ retailerSku: "BAD-1", title: "TMNT", url: "https://unapproved.example/item", state: "active", onlineState: "online_only" }]
    })).toMatchObject({ kind: "malformed", rawRef: "redacted:disallowed-host" });
  });
});
