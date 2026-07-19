import { describe, expect, it } from "vitest";
import { crowdSightingToRankingEvidence } from "@/ranking/crowd-evidence";
import { rankStore } from "@/ranking/rank-store";

describe("crowd ranking evidence", () => {
  it("maps an exact named-store photo to existing transparent factors", () => {
    const evidence = crowdSightingToRankingEvidence({
      id: "sighting-1",
      retailerKey: "ross",
      locationScope: "NAMED_STORE",
      evidenceKind: "EXACT_PRODUCT_PHOTO",
      reviewStatus: "AUTO_ACCEPTED",
      confidenceReasons: ["ROSS_NAMED_LOCAL_STORE", "EXACT_IDENTIFIER"],
      observedAt: new Date("2026-07-18T16:00:00.000Z"),
      postedAt: new Date("2026-07-18T16:05:00.000Z")
    });
    const ranked = rankStore({ productId: "product-1", storeId: "store-1", calculatedAt: new Date("2026-07-18T18:00:00.000Z"), storePreference: 0, evidence: [evidence] });

    expect(ranked.factors.map((factor) => factor.code)).toEqual(expect.arrayContaining(["EXACT_NAMED_STORE_24H", "EXACT_PRODUCT_PHOTO"]));
    expect(ranked.factors.every((factor) => factor.evidenceRef === "sighting:sighting-1")).toBe(true);
  });

  it("keeps regional Ross exact evidence weaker and marks review uncertainty", () => {
    const evidence = crowdSightingToRankingEvidence({
      id: "sighting-2",
      retailerKey: "ross",
      locationScope: "REGIONAL",
      evidenceKind: "EXACT_PRODUCT_TEXT",
      reviewStatus: "NEEDS_REVIEW",
      confidenceReasons: ["REGIONAL_LOCATION_TERM", "PRODUCT_MAPPING_REVIEW_REQUIRED"],
      postedAt: new Date("2026-07-18T12:00:00.000Z")
    });
    expect(evidence).toMatchObject({ regionalRossActivity: true, exactText: true, uncertainLocation: true });
    expect(evidence.exactNamedStoreSighting).toBe(false);
  });

  it("keeps line and wave evidence visibly weaker than exact product evidence", () => {
    const exact = crowdSightingToRankingEvidence({ id: "exact", locationScope: "LOCAL_CITY", evidenceKind: "EXACT_PRODUCT_PHOTO", reviewStatus: "AUTO_ACCEPTED", confidenceReasons: [], postedAt: new Date("2026-07-18T12:00:00.000Z") });
    const wave = crowdSightingToRankingEvidence({ id: "wave", locationScope: "LOCAL_CITY", evidenceKind: "LINE_OR_WAVE_PHOTO", reviewStatus: "AUTO_ACCEPTED", confidenceReasons: [], postedAt: new Date("2026-07-18T12:00:00.000Z") });
    const ranked = rankStore({ productId: "product-1", storeId: "store-1", calculatedAt: new Date("2026-07-18T13:00:00.000Z"), storePreference: 0, evidence: [exact, wave] });
    const exactPoints = ranked.factors.find((factor) => factor.code === "EXACT_PRODUCT_PHOTO")?.points ?? 0;
    const wavePoints = ranked.factors.find((factor) => factor.code === "LINE_OR_WAVE_PHOTO")?.points ?? 0;
    expect(wavePoints).toBeGreaterThan(0);
    expect(wavePoints).toBeLessThan(exactPoints);
    expect(ranked.factors.find((factor) => factor.code === "LINE_OR_WAVE_PHOTO")?.explanation).toMatch(/line or wave/i);
  });
});
