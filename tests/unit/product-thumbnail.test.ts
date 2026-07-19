import { describe, expect, it } from "vitest";
import { isSafeProductImageUrl } from "@/components/products/product-thumbnail";

describe("product image safety", () => {
  it("renders only committed product assets and rejects remote or traversing paths", () => {
    expect(isSafeProductImageUrl("/products/fixture.png")).toBe(true);
    expect(isSafeProductImageUrl("https://private.example/product.png")).toBe(false);
    expect(isSafeProductImageUrl("/products/../secret.png")).toBe(false);
  });
});
