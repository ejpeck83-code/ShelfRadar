import { describe, expect, it } from "vitest";
import { hasValidGtinCheckDigit, normalizeIdentifier } from "@/domain/identifiers";

describe("identifier normalization", () => {
  it("validates and removes punctuation from GTIN values", () => {
    expect(hasValidGtinCheckDigit("634482541333")).toBe(true);
    expect(normalizeIdentifier("UPC", "6344 8254 1333")).toMatchObject({ valueNormalized: "634482541333", valid: true });
  });
  it("rejects a wrong check digit and keeps DPCI namespaced", () => {
    expect(hasValidGtinCheckDigit("634482541334")).toBe(false);
    expect(normalizeIdentifier("DPCI", "087-16-7921")).toMatchObject({ valueNormalized: "087167921", valid: true });
  });
});
