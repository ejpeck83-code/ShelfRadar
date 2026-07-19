import { describe, expect, it } from "vitest";
import { isSafeProductImageUrl } from "@/components/products/product-thumbnail";

describe("product image safety", () => {
  it("renders committed assets and the reviewed Shopify CDN path only", () => {
    expect(isSafeProductImageUrl("/products/fixture.png")).toBe(true);
    expect(isSafeProductImageUrl("https://cdn.shopify.com/s/files/1/1227/0654/files/tmnt.jpg?v=1")).toBe(true);
    expect(isSafeProductImageUrl("https://private.example/product.png")).toBe(false);
    expect(isSafeProductImageUrl("https://cdn.shopify.com/private/tmnt.jpg")).toBe(false);
    expect(isSafeProductImageUrl("/products/../secret.png")).toBe(false);
  });
});
