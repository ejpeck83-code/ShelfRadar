import { describe, expect, it } from "vitest";
import { manualFieldCheckSchema, manualStatusLabel } from "@/features/hunts/manual-observation";

describe("manual field checks", () => {
  it("accepts one-tap owner field observation statuses", () => {
    const base = { productId: crypto.randomUUID(), listingId: crypto.randomUUID(), storeId: crypto.randomUUID(), mutationId: crypto.randomUUID() };
    expect(manualFieldCheckSchema.parse({ ...base, status: "OUT_OF_STOCK", note: "peg empty" })).toMatchObject({ status: "OUT_OF_STOCK" });
    expect(manualStatusLabel("IN_STOCK")).toBe("Owner field check: saw this product");
  });

  it("rejects unsupported inventory claims and oversized notes", () => {
    const base = { productId: crypto.randomUUID(), listingId: crypto.randomUUID(), mutationId: crypto.randomUUID() };
    expect(() => manualFieldCheckSchema.parse({ ...base, status: "SOURCE_UNAVAILABLE" })).toThrow();
    expect(() => manualFieldCheckSchema.parse({ ...base, status: "IN_STOCK", note: "a".repeat(161) })).toThrow();
  });
});
