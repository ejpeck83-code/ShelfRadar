import type { ProductView } from "@/features/catalog/view-model";
import { rankStore, type RankingResult } from "@/ranking/rank-store";

export const HUNT_EXPERIENCE_FIXTURE_NOW = "2026-07-18T21:00:00.000Z";

export type EvidenceTone = "fresh" | "stale" | "unavailable" | "review";
export type RetailerListingPresentation = {
  retailer: string;
  url: string;
  priceMinor: number | null;
  status: string;
  checkedAt: string;
  sourceAvailable: boolean;
};
export type DiscoverProductPresentation = ProductView & {
  retailers: string[];
  matchReview: "confirmed" | "needs-review";
};
export type HuntLeadPresentation = {
  id: string;
  storeName: string;
  retailer: string;
  retailerStatus: string;
  evidenceLabel: string;
  evidenceTone: EvidenceTone;
  crowdEvidence: string;
  storePreferenceLabel: string;
  scopeLabel?: RossScopeLabel;
  rank: RankingResult;
};
export type SignalKind = "discovery" | "availability" | "crowd" | "ross" | "source-health";
export type SignalFreshness = "fresh" | "stale";
export type RossScopeLabel =
  | "Named local Ross"
  | "Local area"
  | "Regional Ross activity"
  | "National Ross activity"
  | "Location unknown";
export type SignalPresentation = {
  id: string;
  kind: SignalKind;
  title: string;
  description: string;
  excerpt?: string;
  productId: string;
  productName: string;
  retailer: string;
  source: string;
  scope: "local" | "regional" | "national" | "unknown";
  scopeLabel: RossScopeLabel | "Product discovery" | "Availability change" | "Source health";
  freshness: SignalFreshness;
  occurredAt: string;
  sourceAvailable: boolean;
  externalUrl?: string;
};
export type ProductDetailPresentation = {
  product: DiscoverProductPresentation;
  listings: RetailerListingPresentation[];
  availabilityHistory: Array<{
    id: string;
    retailer: string;
    storeName: string;
    status: string;
    observedAt: string;
    sourceAvailable: boolean;
  }>;
  sightings: Array<{
    id: string;
    scopeLabel: RossScopeLabel;
    excerpt: string;
    observedAt: string;
    source: string;
    externalUrl: string;
  }>;
  relatedWaveItems: Array<{ id: string; name: string; relationship: string }>;
  matchReview: { state: "confirmed" | "needs-review"; explanation: string };
};

const presentationOverrides: Record<string, { retailers: string[]; matchReview: DiscoverProductPresentation["matchReview"] }> = {
  "2d1f0d9e-06d4-4e61-b7f1-6d10442fda01": { retailers: ["Target", "Walmart", "Ross"], matchReview: "needs-review" },
  "2d1f0d9e-06d4-4e61-b7f1-6d10442fda02": { retailers: ["Target", "Walmart"], matchReview: "confirmed" },
  "2d1f0d9e-06d4-4e61-b7f1-6d10442fda03": { retailers: ["Target", "NECA Store"], matchReview: "confirmed" }
};

export function toDiscoverPresentation(products: ProductView[]): DiscoverProductPresentation[] {
  return products.map((product) => ({
    ...product,
    ...(presentationOverrides[product.id] ?? { retailers: [product.listing.retailer], matchReview: "confirmed" as const })
  }));
}

function rankedLead(input: Omit<HuntLeadPresentation, "rank"> & {
  storeId: string;
  productId: string;
  storePreference: number;
  evidence: Parameters<typeof rankStore>[0]["evidence"];
}): HuntLeadPresentation {
  const { storeId, productId, evidence, storePreference, ...lead } = input;
  return {
    ...lead,
    rank: rankStore({
      storeId,
      productId,
      calculatedAt: new Date(HUNT_EXPERIENCE_FIXTURE_NOW),
      storePreference,
      evidence
    })
  };
}

export function getHuntLeads(product: ProductView): HuntLeadPresentation[] {
  const leads: HuntLeadPresentation[] = [
    rankedLead({
      id: "ross-fishers-crowd",
      storeId: "ross-fishers-unmapped",
      productId: product.id,
      storeName: "Ross near 116th · Fishers",
      retailer: "Ross",
      retailerStatus: "Crowd report only",
      evidenceLabel: "Observed 2 hours ago",
      evidenceTone: "fresh",
      crowdEvidence: "Exact product photo and identifier in one named-local report",
      storePreferenceLabel: "No store preference saved",
      scopeLabel: "Named local Ross",
      storePreference: 0,
      evidence: [{
        reference: "reddit:ross_local_1",
        observedAt: new Date("2026-07-18T19:00:00.000Z"),
        exactNamedStoreSighting: true,
        exactPhoto: true,
        exactText: true
      }]
    }),
    rankedLead({
      id: "target-fishers",
      storeId: "target-fishers",
      productId: product.id,
      storeName: "Target Fishers",
      retailer: "Target",
      retailerStatus: "Retailer reported in stock",
      evidenceLabel: "Checked 5 hours ago",
      evidenceTone: "fresh",
      crowdEvidence: "No exact recent crowd report",
      storePreferenceLabel: "Preferred store · +5",
      storePreference: 5,
      evidence: [{
        reference: "target-fixture:fishers",
        observedAt: new Date("2026-07-18T16:00:00.000Z"),
        recentRetailPositive: true
      }]
    }),
    rankedLead({
      id: "target-carmel",
      storeId: "target-carmel",
      productId: product.id,
      storeName: "Target Carmel",
      retailer: "Target",
      retailerStatus: "Cached status; source unavailable",
      evidenceLabel: "Last successful check 3 days ago",
      evidenceTone: "unavailable",
      crowdEvidence: "No corroborating product sighting",
      storePreferenceLabel: "Lower preference · −4",
      storePreference: -4,
      evidence: [{
        reference: "target-fixture:carmel",
        observedAt: new Date("2026-07-15T16:00:00.000Z"),
        recentRetailPositive: true,
        sourceUnavailable: true
      }]
    })
  ];
  return leads.sort((a, b) => b.rank.score - a.rank.score || a.storeName.localeCompare(b.storeName));
}

export function getSignals(products: ProductView[]): SignalPresentation[] {
  const first = products[0];
  const second = products[1] ?? first;
  const firstId = first?.id ?? "unavailable-product";
  const firstName = first?.name ?? "Unknown product";
  const secondId = second?.id ?? firstId;
  const secondName = second?.name ?? firstName;
  const signals: SignalPresentation[] = [
    {
      id: "ross-local",
      kind: "ross",
      title: "Exact product reported near 116th in Fishers",
      description: "Community evidence names a local Ross area. It is not a retailer inventory claim.",
      excerpt: "Found today at the Ross by 116th in Fishers, Indiana. UPC 634482541333.",
      productId: firstId,
      productName: firstName,
      retailer: "Ross",
      source: "r/RossFinds",
      scope: "local",
      scopeLabel: "Named local Ross",
      freshness: "fresh",
      occurredAt: "2026-07-18T19:00:00.000Z",
      sourceAvailable: true,
      externalUrl: "https://www.reddit.com/r/RossFinds/comments/ross_local_1/local_find/"
    },
    {
      id: "target-castleton",
      kind: "availability",
      title: "Target Castleton availability changed",
      description: "Retailer status changed to limited. Shelf inventory is not guaranteed.",
      productId: secondId,
      productName: secondName,
      retailer: "Target",
      source: "Target fixture",
      scope: "local",
      scopeLabel: "Availability change",
      freshness: "fresh",
      occurredAt: "2026-07-18T18:20:00.000Z",
      sourceAvailable: true
    },
    {
      id: "crowd-carmel",
      kind: "crowd",
      title: "TMNT line activity reported in Carmel",
      description: "A local city is named, but the report does not identify a specific store.",
      excerpt: "Several Teenage Mutant Ninja Turtles figures, no exact character list.",
      productId: secondId,
      productName: secondName,
      retailer: "Target",
      source: "r/NECATMNT",
      scope: "local",
      scopeLabel: "Local area",
      freshness: "fresh",
      occurredAt: "2026-07-18T17:40:00.000Z",
      sourceAvailable: true,
      externalUrl: "https://www.reddit.com/r/NECATMNT/comments/neca_line_1/carmel_line/"
    },
    {
      id: "ross-regional",
      kind: "ross",
      title: "Last Ronin activity reported in Louisville",
      description: "Nearby-market awareness only; this does not indicate Indianapolis-area stock.",
      excerpt: "Saw the NECA TMNT line there yesterday; check your own stores.",
      productId: firstId,
      productName: firstName,
      retailer: "Ross",
      source: "r/NECATMNT",
      scope: "regional",
      scopeLabel: "Regional Ross activity",
      freshness: "fresh",
      occurredAt: "2026-07-18T17:00:00.000Z",
      sourceAvailable: true,
      externalUrl: "https://www.reddit.com/r/NECATMNT/comments/ross_regional_1/regional_report/"
    },
    {
      id: "product-discovery",
      kind: "discovery",
      title: "New canonical product detected",
      description: "Target listing added with UPC, DPCI, and TCIN identifiers.",
      productId: firstId,
      productName: firstName,
      retailer: "Target",
      source: "Target fixture",
      scope: "national",
      scopeLabel: "Product discovery",
      freshness: "fresh",
      occurredAt: "2026-07-18T16:00:00.000Z",
      sourceAvailable: true
    },
    {
      id: "ross-national",
      kind: "ross",
      title: "TMNT Ross haul reports across the country",
      description: "National awareness only. No local or regional stock conclusion is drawn.",
      excerpt: "Collectors across the country are posting NECA TMNT finds.",
      productId: firstId,
      productName: firstName,
      retailer: "Ross",
      source: "r/RossFinds",
      scope: "national",
      scopeLabel: "National Ross activity",
      freshness: "fresh",
      occurredAt: "2026-07-18T15:00:00.000Z",
      sourceAvailable: true,
      externalUrl: "https://www.reddit.com/r/RossFinds/comments/ross_national_1/national_haul/"
    },
    {
      id: "reddit-unavailable",
      kind: "source-health",
      title: "Reddit source unavailable",
      description: "Cached crowd evidence remains visible with its original timestamps.",
      productId: firstId,
      productName: firstName,
      retailer: "Ross",
      source: "Reddit",
      scope: "unknown",
      scopeLabel: "Source health",
      freshness: "stale",
      occurredAt: "2026-07-18T12:00:00.000Z",
      sourceAvailable: false
    },
    {
      id: "ross-unknown",
      kind: "ross",
      title: "TMNT find posted without a location",
      description: "The report stays reviewable and cannot support a local lead.",
      excerpt: "Fresh shelf today but I forgot to say where.",
      productId: firstId,
      productName: firstName,
      retailer: "Ross",
      source: "r/ActionFigures",
      scope: "unknown",
      scopeLabel: "Location unknown",
      freshness: "stale",
      occurredAt: "2026-07-15T13:00:00.000Z",
      sourceAvailable: true,
      externalUrl: "https://www.reddit.com/r/ActionFigures/comments/ross_unknown_1/no_location/"
    }
  ];
  return signals.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function getProductDetail(product: ProductView): ProductDetailPresentation {
  const presented = toDiscoverPresentation([product])[0]!;
  const secondaryRetailers = presented.retailers.filter((retailer) => retailer !== product.listing.retailer);
  return {
    product: presented,
    listings: [
      {
        ...product.listing,
        checkedAt: product.availability[0]?.observedAt ?? product.firstDetectedAt,
        sourceAvailable: true
      },
      ...secondaryRetailers.map((retailer) => ({
        retailer,
        url: retailer === "Walmart"
          ? "https://www.walmart.com/search?q=TMNT"
          : "https://www.rossstores.com/store-locator/",
        priceMinor: null,
        status: retailer === "Ross" ? "CROWD_ONLY" : "UNKNOWN",
        checkedAt: "2026-07-18T14:00:00.000Z",
        sourceAvailable: retailer !== "Ross"
      }))
    ],
    availabilityHistory: product.availability.map((item, index) => ({
      id: product.id + "-observation-" + index,
      retailer: product.listing.retailer,
      ...item
    })),
    sightings: [{
      id: "ross-local",
      scopeLabel: "Named local Ross",
      excerpt: "Found today at the Ross by 116th in Fishers, Indiana. UPC 634482541333.",
      observedAt: "2026-07-18T19:00:00.000Z",
      source: "r/RossFinds",
      externalUrl: "https://www.reddit.com/r/RossFinds/comments/ross_local_1/local_find/"
    }],
    relatedWaveItems: [{
      id: "curated-last-ronin-raphael",
      name: "NECA The Last Ronin Ultimate Raphael",
      relationship: "Manually curated · same Last Ronin wave"
    }],
    matchReview: presented.matchReview === "needs-review"
      ? { state: "needs-review", explanation: "A crowd post names exact identifiers that require duplicate review; no automatic merge occurred." }
      : { state: "confirmed", explanation: "Identifier-backed canonical match." }
  };
}

export function filterSignals(
  signals: SignalPresentation[],
  filters: { kind: string; retailer: string; scope: string; freshness: string; product: string }
): SignalPresentation[] {
  return signals.filter((signal) =>
    (filters.kind === "all" || signal.kind === filters.kind) &&
    (filters.retailer === "all" || signal.retailer === filters.retailer) &&
    (filters.scope === "all" || signal.scope === filters.scope) &&
    (filters.freshness === "all" || signal.freshness === filters.freshness) &&
    (filters.product === "all" || signal.productId === filters.product)
  );
}
