import type { ProductView } from "@/features/catalog/view-model";
import { crowdSightingToRankingEvidence } from "@/ranking/crowd-evidence";
import { rankStore, type RankingFactor } from "@/ranking/rank-store";

export type HuntLeadView = {
  id: string;
  name: string;
  retailer: string;
  label: "Strong lead" | "Possible lead" | "Weak lead" | "Insufficient evidence";
  score: number;
  factors: RankingFactor[];
  calculatedAt: string;
  scopeLabel?: string;
  sourceNote: string;
};

type HuntLeadOptions = {
  calculatedAt?: Date;
  includeFixtureCrowd?: boolean;
};

export function buildHuntLeads(product: ProductView, options: HuntLeadOptions = {}): HuntLeadView[] {
  const calculatedAt = options.calculatedAt ?? new Date();
  const leads: HuntLeadView[] = [];
  for (const listing of product.listings) {
    const latestByStore = new Map<string, (typeof listing.availability)[number]>();
    for (const observation of listing.availability) {
      const current = latestByStore.get(observation.storeName);
      if (!current || observation.observedAt > current.observedAt) latestByStore.set(observation.storeName, observation);
    }
    for (const observation of latestByStore.values()) {
      if (observation.status === "ONLINE_ONLY") continue;
      const positive = ["IN_STOCK", "LIMITED"].includes(observation.status);
      const result = rankStore({
        productId: product.id,
        storeId: `${listing.retailerKey}:${observation.storeName}`,
        calculatedAt,
        storePreference: 0,
        evidence: [{
          reference: `observation:${listing.id}:${observation.storeName}`,
          observedAt: new Date(observation.observedAt),
          recentRetailPositive: positive,
          sourceUnavailable: !observation.sourceAvailable
        }]
      });
      leads.push({
        id: `${listing.id}:${observation.storeName}`,
        name: observation.storeName,
        retailer: listing.retailer,
        label: labelText(result.label),
        score: result.score,
        factors: result.factors,
        calculatedAt: result.calculatedAt,
        sourceNote: observation.sourceAvailable ? "Retailer observation; not shelf certainty" : "Source unavailable; no inventory conclusion"
      });
    }
  }
  if (options.includeFixtureCrowd && product.identifiers.some((identifier) => identifier.kind === "UPC" && identifier.value === "634482541333")) {
    const evidence = crowdSightingToRankingEvidence({
      id: "ross_local_1",
      retailerKey: "ross",
      locationScope: "NAMED_STORE",
      evidenceKind: "EXACT_PRODUCT_PHOTO",
      reviewStatus: "AUTO_ACCEPTED",
      confidenceReasons: ["ROSS_NAMED_LOCAL_STORE", "EXACT_IDENTIFIER", "PHOTO_LINK_PRESENT"],
      observedAt: new Date("2026-07-18T17:30:00.000Z"),
      postedAt: new Date("2026-07-18T17:30:00.000Z")
    });
    const result = rankStore({ productId: product.id, storeId: "ross:fishers-report", calculatedAt, storePreference: 0, evidence: [evidence] });
    leads.push({ id: "ross:fishers-report", name: "Ross Fishers report", retailer: "Ross", label: labelText(result.label), score: result.score, factors: result.factors, calculatedAt: result.calculatedAt, scopeLabel: "Named-store report", sourceNote: "Public crowd report; no mapped Ross inventory record" });
  }
  return leads.sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}

function labelText(label: string): HuntLeadView["label"] {
  return ({ STRONG: "Strong lead", POSSIBLE: "Possible lead", WEAK: "Weak lead", INSUFFICIENT: "Insufficient evidence" } as const)[label as "STRONG" | "POSSIBLE" | "WEAK" | "INSUFFICIENT"] ?? "Insufficient evidence";
}
