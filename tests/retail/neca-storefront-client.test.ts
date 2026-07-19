import { describe, expect, it, vi } from "vitest";
import { NecaAdapter } from "@/adapters/retail/neca";
import { NecaStorefrontProvider } from "@/adapters/retail/neca/storefront-client";

const context = { signal: new AbortController().signal, requestId: "neca-live", now: new Date("2026-07-19T12:00:00.000Z") };
const payload = {
  products: [{
    id: 10433614414005,
    title: "Teenage Mutant Ninja Turtles (2012 Cartoon) - Ultimate Splinter 7\" Scale Action Figure (PRE-ORDER)",
    handle: "teenage-mutant-ninja-turtles-2012-cartoon-ultimate-splinter-7-inch-scale-action-figure",
    published_at: "2026-05-26T14:05:25-04:00",
    updated_at: "2026-07-19T08:10:53-04:00",
    vendor: "Teenage Mutant Ninja Turtles",
    product_type: "Figure",
    tags: ["TMNT", "Pre-Order"],
    variants: [{ id: 52499042074805, sku: "NE54471-01", available: true, price: "37.99" }],
    images: [{ src: "https://cdn.shopify.com/s/files/1/1227/0654/files/54471_UNP_2.jpg" }]
  }]
};

describe("official NECA Store provider", () => {
  it("discovers current products, prices, SKUs, images, and honest online preorder state", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } }));
    const provider = new NecaStorefrontProvider({ fetchImpl, minRequestIntervalMs: 0 });
    const adapter = new NecaAdapter("provider", provider);
    const result = await adapter.discover({ terms: ["TMNT"], pageLimit: 1 }, context);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://store.necaonline.com/collections/teenage-mutant-ninja-turtles/products.json?limit=50&page=1");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") return;
    expect(result.items[0]).toMatchObject({
      externalId: "10433614414005",
      canonicalUrl: "https://store.necaonline.com/products/teenage-mutant-ninja-turtles-2012-cartoon-ultimate-splinter-7-inch-scale-action-figure",
      imageUrl: "https://cdn.shopify.com/s/files/1/1227/0654/files/54471_UNP_2.jpg",
      priceMinor: 3799,
      listingStatus: "PREORDER",
      availability: [{ status: "PREORDER", rawLabel: "preorder" }],
      identifiers: expect.arrayContaining([{ kind: "MANUFACTURER_SKU", value: "NE54471-01", confidence: "CLAIMED" }])
    });
  });

  it("maps unavailable variants to out of stock and returns structured throttling", async () => {
    const soldOut = structuredClone(payload);
    soldOut.products[0]!.variants[0]!.available = false;
    const soldOutFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(soldOut), { status: 200 }));
    const soldOutResult = await new NecaAdapter("provider", new NecaStorefrontProvider({ fetchImpl: soldOutFetch, minRequestIntervalMs: 0 })).discover({ terms: ["TMNT"], pageLimit: 1 }, context);
    expect(soldOutResult).toMatchObject({ kind: "success", items: [{ listingStatus: "OUT_OF_STOCK", availability: [{ status: "OUT_OF_STOCK" }] }] });

    const throttledFetch = vi.fn().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "120" } }));
    const throttled = new NecaStorefrontProvider({ fetchImpl: throttledFetch, minRequestIntervalMs: 0 });
    await expect(throttled.discover({ terms: ["TMNT"], pageLimit: 1 }, context)).resolves.toMatchObject({ kind: "throttled", retryAfter: "2026-07-19T12:02:00.000Z" });
  });
});
