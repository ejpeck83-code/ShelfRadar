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
});
