import { describe, expect, it } from "vitest";
import { rankStore, RANKING_RULES_VERSION } from "@/ranking/rank-store";

describe("transparent ranking v1", () => {
  const now = new Date("2026-07-18T20:00:00.000Z");
  it("returns ordered points and explanations without probability", () => {
    const result = rankStore({ productId: "p", storeId: "s", calculatedAt: now, storePreference: 3, evidence: [{ reference: "obs:1", observedAt: new Date("2026-07-18T16:00:00.000Z"), recentRetailPositive: true }] });
    expect(result).toMatchObject({ score: 33, label: "POSSIBLE", rulesVersion: RANKING_RULES_VERSION });
    expect(result.factors.map((factor) => factor.code)).toEqual(["RETAIL_POSITIVE_12H", "EXPLICIT_STORE_PREFERENCE"]);
    expect(JSON.stringify(result)).not.toMatch(/percent|probability/i);
  });
  it("exposes unavailable as neutral uncertainty", () => {
    const result = rankStore({ productId: "p", storeId: "s", calculatedAt: now, storePreference: 0, evidence: [{ reference: "run:1", observedAt: now, sourceUnavailable: true }] });
    expect(result).toMatchObject({ score: 0, label: "INSUFFICIENT" });
    expect(result.factors[0]).toMatchObject({ code: "SOURCE_UNAVAILABLE", points: 0, direction: "neutral" });
  });
  it("uses owner field checks as strong local evidence without treating them as retailer truth", () => {
    const sawIt = rankStore({ productId: "p", storeId: "s", calculatedAt: now, storePreference: 0, evidence: [{ reference: "manual:1", observedAt: new Date("2026-07-18T18:00:00.000Z"), ownerSawProduct: true }] });
    const checkedNone = rankStore({ productId: "p", storeId: "s", calculatedAt: now, storePreference: 0, evidence: [{ reference: "manual:2", observedAt: new Date("2026-07-18T18:00:00.000Z"), ownerCheckedNone: true }] });
    expect(sawIt.factors[0]).toMatchObject({ code: "OWNER_SAW_PRODUCT_24H", points: 45, direction: "positive" });
    expect(checkedNone.factors[0]).toMatchObject({ code: "OWNER_CHECKED_NONE_24H", points: -35, direction: "negative" });
  });
});
