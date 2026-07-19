import type { RankingEvidence } from "./rank-store";

export type CrowdRankingSighting = {
  id: string;
  retailerKey?: string;
  locationScope: "NAMED_STORE" | "LOCAL_CITY" | "REGIONAL" | "NATIONAL" | "UNKNOWN";
  evidenceKind: "EXACT_PRODUCT_PHOTO" | "EXACT_PRODUCT_TEXT" | "LINE_OR_WAVE_PHOTO" | "LINE_OR_WAVE_TEXT" | "GENERAL_RETAILER_ACTIVITY";
  reviewStatus: "AUTO_ACCEPTED" | "NEEDS_REVIEW" | "REJECTED";
  confidenceReasons: readonly string[];
  observedAt?: Date;
  postedAt: Date;
};

export function crowdSightingToRankingEvidence(sighting: CrowdRankingSighting): RankingEvidence {
  const exactPhoto = sighting.evidenceKind === "EXACT_PRODUCT_PHOTO";
  const exactText = sighting.evidenceKind === "EXACT_PRODUCT_TEXT" || (exactPhoto && sighting.confidenceReasons.includes("EXACT_IDENTIFIER"));
  const exactProduct = exactPhoto || exactText;
  return {
    reference: `sighting:${sighting.id}`,
    observedAt: sighting.observedAt ?? sighting.postedAt,
    exactNamedStoreSighting: exactProduct && sighting.locationScope === "NAMED_STORE" && sighting.reviewStatus === "AUTO_ACCEPTED",
    exactPhoto,
    exactText,
    lineWavePhoto: sighting.evidenceKind === "LINE_OR_WAVE_PHOTO",
    lineWaveText: sighting.evidenceKind === "LINE_OR_WAVE_TEXT",
    regionalRossActivity: sighting.retailerKey === "ross" && sighting.locationScope === "REGIONAL" && exactProduct,
    uncertainLocation: sighting.reviewStatus !== "AUTO_ACCEPTED" || sighting.locationScope === "UNKNOWN" || sighting.locationScope === "NATIONAL",
    likelyRepost: sighting.confidenceReasons.includes("LIKELY_REPOST")
  };
}
