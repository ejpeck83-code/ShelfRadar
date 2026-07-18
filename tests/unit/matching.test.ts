import { describe, expect, it } from "vitest";
import type { RawListing } from "@/domain/adapters";
import { matchProduct } from "@/matching/match-product";

const listing = { title: "Same Title", identifiers: [{ kind: "UPC", value: "634482541333", confidence: "EXACT" }] } as RawListing;
describe("deterministic matching", () => {
  it("matches one exact identifier", () => {
    expect(matchProduct(listing, [{ productId: "one", identifiers: [{ kind: "UPC", valueNormalized: "634482541333" }] }], "target")).toEqual({ kind: "match", productId: "one", reason: "EXACT_IDENTIFIER" });
  });
  it("routes conflicting exact identifiers to review", () => {
    const conflicting: RawListing = { ...listing, identifiers: [...listing.identifiers, { kind: "TCIN" as const, value: "91234567", confidence: "EXACT" as const }] };
    const result = matchProduct(conflicting, [
      { productId: "one", identifiers: [{ kind: "UPC", valueNormalized: "634482541333" }] },
      { productId: "two", identifiers: [{ kind: "TCIN", valueNormalized: "91234567", retailerKey: "target" }] }
    ], "target");
    expect(result).toEqual({ kind: "review", candidateProductIds: ["one", "two"], reason: "CONFLICTING_EXACT_IDENTIFIERS" });
  });
  it("never auto-merges a title-only candidate", () => {
    expect(matchProduct({ ...listing, identifiers: [] }, [{ productId: "one", identifiers: [] }], "target")).toEqual({ kind: "create", reason: "TITLE_ONLY_NOT_ALLOWED" });
  });
});
