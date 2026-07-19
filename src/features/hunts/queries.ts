import type { AvailabilityView, ProductView, RetailerActionLink } from "@/features/catalog/view-model";
import { crowdSightingToRankingEvidence } from "@/ranking/crowd-evidence";
import { rankStore, type RankingEvidence, type RankingFactor } from "@/ranking/rank-store";

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

export type FieldCheckTaskView = {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string | null;
  listingId?: string;
  retailer: string;
  retailerKey: string;
  storeId?: string;
  storeName: string;
  storeLocation?: string;
  sourceState: string;
  statusText: string;
  lastSignalAt?: string;
  lastManualCheckAt?: string;
  lastManualCheckLabel?: string | null;
  shouldCheckToday: boolean;
  sourceNote: string;
  actionLinks: RetailerActionLink[];
  lead: HuntLeadView;
};

type HuntLeadOptions = {
  calculatedAt?: Date;
  includeFixtureCrowd?: boolean;
};

type FieldStoreCandidate = { storeId?: string; storeName: string; storeLocation?: string };

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
          sourceUnavailable: !observation.sourceAvailable || ["unavailable", "pending-sanctioned-access"].includes(listing.sourceState)
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
        sourceNote: observation.sourceAvailable && listing.sourceState !== "unavailable" ? "Retailer observation; not shelf certainty" : "Cached observation; source unavailable and no new inventory conclusion"
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

export function buildFieldCheckTasks(products: ProductView[], options: HuntLeadOptions = {}): FieldCheckTaskView[] {
  const calculatedAt = options.calculatedAt ?? new Date();
  const listingTasks = products.flatMap((product) => product.listings.flatMap((listing) => {
    if (listing.retailerKey === "neca" || listing.availability.every((observation) => observation.status === "ONLINE_ONLY")) return [];
    const stores: FieldStoreCandidate[] = listing.fieldStores.length
      ? listing.fieldStores.map((store) => ({ storeId: store.id, storeName: store.name, storeLocation: `${store.city}, ${store.region}` }))
      : latestStoreNames(listing.availability).map((storeName) => ({ storeName }));
    const fieldStores = stores.length ? stores : [{ storeName: `${listing.retailer} area check` }];
    return fieldStores.map((store) => {
      const observations = listing.availability.filter((observation) => observation.storeName === store.storeName);
      const latest = latestObservation(observations);
      const latestManual = latestObservation(observations.filter((observation) => observation.sourceKind === "owner_manual_field_check"));
      const evidence = evidenceForObservation(latest, listing.id, store.storeName);
      const result = rankStore({ productId: product.id, storeId: store.storeId ?? `${listing.retailerKey}:${store.storeName}`, calculatedAt, storePreference: 0, evidence: evidence ? [evidence] : [] });
      const lead: HuntLeadView = {
        id: `${listing.id}:${store.storeId ?? store.storeName}`,
        name: store.storeName,
        retailer: listing.retailer,
        label: labelText(result.label),
        score: result.score,
        factors: result.factors,
        calculatedAt: result.calculatedAt,
        sourceNote: sourceNoteFor(listing.sourceState, latest)
      };
      return {
        id: `${product.id}:${listing.id}:${store.storeId ?? store.storeName}`,
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        listingId: listing.id,
        retailer: listing.retailer,
        retailerKey: listing.retailerKey,
        sourceState: listing.sourceState,
        statusText: latest ? statusTextFor(latest) : "No store-specific evidence yet",
        storeName: store.storeName,
        ...(store.storeId ? { storeId: store.storeId } : {}),
        ...(store.storeLocation ? { storeLocation: store.storeLocation } : {}),
        ...(latest?.observedAt ? { lastSignalAt: latest.observedAt } : {}),
        ...(latestManual?.observedAt ? { lastManualCheckAt: latestManual.observedAt } : {}),
        ...(latestManual?.rawLabel !== undefined ? { lastManualCheckLabel: latestManual.rawLabel } : {}),
        shouldCheckToday: !latestManual || hoursBetween(calculatedAt, new Date(latestManual.observedAt)) >= 20,
        sourceNote: lead.sourceNote,
        actionLinks: listing.actionLinks,
        lead
      };
    });
  }));
  const scoutTasks = products.flatMap((product) => {
    const listingRetailers = new Set(product.listings.map((listing) => listing.retailerKey));
    return product.scoutStores.filter((store) => !listingRetailers.has(store.retailerKey)).map((store) => {
      const result = rankStore({ productId: product.id, storeId: store.id, calculatedAt, storePreference: 0, evidence: [] });
      const lead: HuntLeadView = {
        id: `scout:${product.id}:${store.id}`,
        name: store.name,
        retailer: store.retailer,
        label: labelText(result.label),
        score: result.score,
        factors: result.factors,
        calculatedAt: result.calculatedAt,
        sourceNote: "Scout card; no sanctioned retailer listing yet"
      };
      return {
        id: `scout:${product.id}:${store.id}`,
        productId: product.id,
        productName: product.name,
        productImageUrl: product.imageUrl,
        retailer: store.retailer,
        retailerKey: store.retailerKey,
        storeId: store.id,
        storeName: store.name,
        storeLocation: `${store.city}, ${store.region}`,
        sourceState: "pending-sanctioned-access",
        statusText: "No store-specific evidence yet",
        shouldCheckToday: true,
        sourceNote: "Target access is pending; use this as a manual scout card",
        actionLinks: store.actionLinks,
        lead
      };
    });
  });
  const tasks = [...listingTasks, ...scoutTasks];
  return tasks.sort((left, right) =>
    Number(right.shouldCheckToday) - Number(left.shouldCheckToday)
    || right.lead.score - left.lead.score
    || left.storeName.localeCompare(right.storeName)
    || left.productName.localeCompare(right.productName)
  );
}

function labelText(label: string): HuntLeadView["label"] {
  return ({ STRONG: "Strong lead", POSSIBLE: "Possible lead", WEAK: "Weak lead", INSUFFICIENT: "Insufficient evidence" } as const)[label as "STRONG" | "POSSIBLE" | "WEAK" | "INSUFFICIENT"] ?? "Insufficient evidence";
}

function latestObservation(observations: AvailabilityView[]): AvailabilityView | undefined {
  return observations.reduce<AvailabilityView | undefined>((latest, observation) => !latest || observation.observedAt > latest.observedAt ? observation : latest, undefined);
}

function latestStoreNames(observations: AvailabilityView[]): string[] {
  return [...new Set(observations.filter((observation) => observation.status !== "ONLINE_ONLY").map((observation) => observation.storeName))];
}

function evidenceForObservation(observation: AvailabilityView | undefined, listingId: string, storeName: string): RankingEvidence | undefined {
  if (!observation) return undefined;
  const base = { reference: `observation:${listingId}:${storeName}`, observedAt: new Date(observation.observedAt) };
  if (observation.sourceKind === "owner_manual_field_check") {
    return {
      ...base,
      ownerSawProduct: observation.status === "IN_STOCK",
      ownerSawLimited: observation.status === "LIMITED",
      ownerCheckedNone: observation.status === "OUT_OF_STOCK",
      ownerCheckedUncertain: observation.status === "UNKNOWN"
    };
  }
  return {
    ...base,
    recentRetailPositive: ["IN_STOCK", "LIMITED"].includes(observation.status),
    sourceUnavailable: !observation.sourceAvailable || observation.status === "SOURCE_UNAVAILABLE"
  };
}

function hoursBetween(now: Date, then: Date): number {
  return Math.max(0, (now.getTime() - then.getTime()) / 3_600_000);
}

function statusTextFor(observation: AvailabilityView): string {
  if (observation.sourceKind === "owner_manual_field_check") return observation.rawLabel ?? `Owner field check: ${observation.status.toLowerCase().replaceAll("_", " ")}`;
  return observation.status === "SOURCE_UNAVAILABLE" ? "Source unavailable; cached data only" : observation.status.toLowerCase().replaceAll("_", " ");
}

function sourceNoteFor(sourceState: string, observation: AvailabilityView | undefined): string {
  if (observation?.sourceKind === "owner_manual_field_check") return "Your field check; not retailer inventory truth";
  if (sourceState === "pending-sanctioned-access") return "Retailer access pending; use links and manual checks";
  if (sourceState === "unavailable") return "Source unavailable; cached data remains readable";
  return "Retailer/community signal; not shelf certainty";
}
