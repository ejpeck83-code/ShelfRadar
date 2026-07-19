export const RANKING_RULES_VERSION = "mvp-v1.1.0";

export type RankingEvidence = {
  reference: string;
  observedAt: Date;
  exactNamedStoreSighting?: boolean;
  exactPhoto?: boolean;
  exactText?: boolean;
  lineWavePhoto?: boolean;
  lineWaveText?: boolean;
  recentRetailPositive?: boolean;
  regionalRossActivity?: boolean;
  independentCorroborationCount?: number;
  uncertainLocation?: boolean;
  likelyRepost?: boolean;
  sourceUnavailable?: boolean;
};

export type RankingInput = {
  productId: string;
  storeId: string;
  calculatedAt: Date;
  storePreference: number;
  evidence: RankingEvidence[];
};

export type RankingFactor = {
  code: string;
  direction: "positive" | "negative" | "neutral";
  points: number;
  explanation: string;
  evidenceRef: string;
  observedAt: string;
};

export type RankingResult = {
  score: number;
  label: "STRONG" | "POSSIBLE" | "WEAK" | "INSUFFICIENT";
  factors: RankingFactor[];
  calculatedAt: string;
  rulesVersion: typeof RANKING_RULES_VERSION;
};

function hoursBetween(now: Date, then: Date): number {
  return Math.max(0, (now.getTime() - then.getTime()) / 3_600_000);
}

export function rankStore(input: RankingInput): RankingResult {
  const factors: RankingFactor[] = [];
  const add = (evidence: RankingEvidence, code: string, points: number, explanation: string) =>
    factors.push({
      code,
      points,
      direction: points > 0 ? "positive" : points < 0 ? "negative" : "neutral",
      explanation,
      evidenceRef: evidence.reference,
      observedAt: evidence.observedAt.toISOString()
    });

  for (const evidence of input.evidence) {
    const age = hoursBetween(input.calculatedAt, evidence.observedAt);
    if (evidence.exactNamedStoreSighting && age <= 24) add(evidence, "EXACT_NAMED_STORE_24H", 40, "Exact named-store sighting within 24 hours");
    if (evidence.exactPhoto && age <= 72) add(evidence, "EXACT_PRODUCT_PHOTO", 15, "Exact product photo evidence");
    if (evidence.exactText && age <= 72) add(evidence, "EXACT_PRODUCT_TEXT", 10, "Exact product text or identifier evidence");
    if (evidence.lineWavePhoto && age <= 72) add(evidence, "LINE_OR_WAVE_PHOTO", 5, "Line or wave photo activity; weaker than exact product evidence");
    if (evidence.lineWaveText && age <= 72) add(evidence, "LINE_OR_WAVE_TEXT", 2, "Line or wave text activity; weaker than exact product evidence");
    if (evidence.recentRetailPositive) {
      if (age <= 12) add(evidence, "RETAIL_POSITIVE_12H", 30, "Retailer reported in stock or limited within 12 hours");
      else if (age <= 36) add(evidence, "RETAIL_POSITIVE_36H", 15, "Retailer reported in stock or limited 12–36 hours ago");
      else if (age > 48) add(evidence, "STALE_RETAIL_SIGNAL", -10, "Retailer signal is unchanged for more than 48 hours");
    }
    if (evidence.regionalRossActivity && age <= 72) add(evidence, "REGIONAL_ROSS_72H", 10, "Regional same-product Ross activity within 72 hours");
    if ((evidence.independentCorroborationCount ?? 0) >= 2) add(evidence, "INDEPENDENT_CORROBORATION", 10, "Multiple independent reports corroborate the lead");
    if (evidence.uncertainLocation || evidence.likelyRepost) add(evidence, "UNCERTAIN_OR_REPOST", -15, "Location is uncertain or evidence may be a repost");
    if (evidence.sourceUnavailable) add(evidence, "SOURCE_UNAVAILABLE", 0, "Source is unavailable; no inventory conclusion was drawn");
  }

  const preference = Math.max(-10, Math.min(10, Math.trunc(input.storePreference)));
  if (preference !== 0) {
    const observedAt = input.calculatedAt.toISOString();
    factors.push({
      code: "EXPLICIT_STORE_PREFERENCE",
      points: preference,
      direction: preference > 0 ? "positive" : "negative",
      explanation: "Your explicit store preference",
      evidenceRef: `store-profile:${input.storeId}`,
      observedAt
    });
  }
  const score = factors.reduce((sum, factor) => sum + factor.points, 0);
  const substantive = factors.some((factor) => factor.code !== "SOURCE_UNAVAILABLE" && factor.code !== "EXPLICIT_STORE_PREFERENCE");
  const label = !substantive ? "INSUFFICIENT" : score >= 55 ? "STRONG" : score >= 25 ? "POSSIBLE" : "WEAK";
  return { score, label, factors, calculatedAt: input.calculatedAt.toISOString(), rulesVersion: RANKING_RULES_VERSION };
}
