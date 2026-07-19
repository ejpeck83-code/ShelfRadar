import type { ProductView } from "./view-model";
import type { UserProductState } from "@/domain/catalog";
import { retailerActionLinks } from "@/features/retailer-links";

const targetFieldStores = [
  { id: "fixture-target-fishers", name: "Target Fishers", city: "Fishers", region: "IN" },
  { id: "fixture-target-carmel", name: "Target Carmel", city: "Carmel", region: "IN" },
  { id: "fixture-target-westfield", name: "Target Westfield", city: "Westfield", region: "IN" },
  { id: "fixture-target-castleton", name: "Target Castleton", city: "Indianapolis", region: "IN" },
  { id: "fixture-target-noblesville", name: "Target Noblesville", city: "Noblesville", region: "IN" }
];

const fixtureProducts: Array<Omit<ProductView, "listings" | "scoutStores"> & { listings: Array<Omit<ProductView["listings"][number], "fieldStores" | "actionLinks">> }> = [
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda01", name: "NECA TMNT The Last Ronin Ultimate Leonardo", brand: "NECA", line: "The Last Ronin", productType: "Action Figure", imageUrl: "/products/fixture-last-ronin-leonardo.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "634482541333" }, { kind: "DPCI", value: "087-16-7921" }, { kind: "TCIN", value: "91234567" }, { kind: "WALMART_ITEM_ID", value: "147258369" }, { kind: "MANUFACTURER_SKU", value: "54133" }],
    listings: [
      { id: "target:91234567", retailerKey: "target", retailer: "Target", url: "https://www.target.com/p/-/A-91234567", priceMinor: 3499, status: "ACTIVE", sourceState: "fixture-only", availability: [
        { status: "IN_STOCK", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Fishers", sourceAvailable: true },
        { status: "SOURCE_UNAVAILABLE", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Carmel", sourceAvailable: false }
      ] },
      { id: "walmart:147258369", retailerKey: "walmart", retailer: "Walmart", url: "https://www.walmart.com/ip/147258369", priceMinor: 3499, status: "ACTIVE", sourceState: "fixture-only", availability: [
        { status: "IN_STOCK", observedAt: "2026-07-18T16:05:00.000Z", storeName: "Walmart Indianapolis area", sourceAvailable: true }
      ] },
      { id: "neca:NECA-54133", retailerKey: "neca", retailer: "NECA Store", url: "https://store.necaonline.com/products/tmnt-last-ronin-leonardo-sanitized", priceMinor: 3499, status: "ACTIVE", sourceState: "fixture-only", availability: [
        { status: "ONLINE_ONLY", observedAt: "2026-07-18T16:20:00.000Z", storeName: "NECA online", sourceAvailable: true }
      ] }
    ],
    matchingSummary: "Exact UPC shared across Target, Walmart, and NECA"
  },
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda02", name: "Playmates TMNT Mutant Mayhem Sewer Lair Set", brand: "Playmates Toys", line: "Mutant Mayhem", productType: "Playset", imageUrl: "/products/fixture-mutant-mayhem-lair.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "043377834917" }, { kind: "DPCI", value: "087-06-7734" }, { kind: "TCIN", value: "92345678" }],
    listings: [
      { id: "target:92345678", retailerKey: "target", retailer: "Target", url: "https://www.target.com/p/-/A-92345678", priceMinor: 5999, status: "ACTIVE", sourceState: "fixture-only", availability: [{ status: "ONLINE_ONLY", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target online", sourceAvailable: true }] },
      { id: "walmart:258369147", retailerKey: "walmart", retailer: "Walmart", url: "https://www.walmart.com/ip/258369147", priceMinor: 5999, status: "ACTIVE", sourceState: "fixture-only", availability: [{ status: "ONLINE_ONLY", observedAt: "2026-07-18T16:05:00.000Z", storeName: "Walmart online", sourceAvailable: true }] }
    ],
    matchingSummary: "Separate retailer listings linked by canonical review"
  },
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda03", name: "Super7 TMNT Ultimates Donatello", brand: "Super7", line: "Ultimates!", productType: "Action Figure", imageUrl: "/products/fixture-ultimates-donatello.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "840049827543" }, { kind: "TCIN", value: "93456789" }],
    listings: [{ id: "target:93456789", retailerKey: "target", retailer: "Target", url: "https://www.target.com/p/-/A-93456789", priceMinor: 5499, status: "OUT_OF_STOCK", sourceState: "fixture-only", availability: [{ status: "OUT_OF_STOCK", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Westfield", sourceAvailable: true }] }],
    matchingSummary: "Exact Target identifier-backed fixture"
  },
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda04", name: "Playmates Teenage Mutant Ninja Turtles Mutant Mayhem Raphael Action Figure with Extra-Long Fixture Title", brand: "Playmates Toys", line: "Mutant Mayhem", productType: "Action Figure", imageUrl: null, firstDetectedAt: "2026-07-10T13:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "012345678905" }, { kind: "MEIJER_SKU", value: "MEI-901245" }],
    listings: [{ id: "meijer:MEI-901245", retailerKey: "meijer", retailer: "Meijer", url: "https://www.meijer.com/shopping/product/MEI-901245.html", priceMinor: 999, status: "ACTIVE", sourceState: "fixture-only", availability: [{ status: "UNKNOWN", observedAt: "2026-07-10T13:10:00.000Z", storeName: "Meijer Indianapolis area", sourceAvailable: true }] }],
    matchingSummary: "Exact Meijer SKU; UPC independently validated"
  }
];

type FixtureRuntime = { states: Map<string, UserProductState>; mutations: Set<string> };
const fixtureGlobal = globalThis as typeof globalThis & { __shelfRadarFixtureRuntime?: FixtureRuntime };
const runtime = fixtureGlobal.__shelfRadarFixtureRuntime ?? { states: new Map<string, UserProductState>(), mutations: new Set<string>() };
fixtureGlobal.__shelfRadarFixtureRuntime = runtime;

export function listFixtureProducts(): ProductView[] { return fixtureProducts.map((product) => enrichFixtureProduct({ ...product, state: runtime.states.get(product.id) ?? product.state })); }
export function getFixtureProduct(id: string): ProductView | null { return listFixtureProducts().find((product) => product.id === id) ?? null; }
export function setFixtureProductState(productId: string, state: UserProductState, mutationId: string): void {
  if (runtime.mutations.has(mutationId)) return;
  if (!fixtureProducts.some((product) => product.id === productId)) throw new Error("Product not found");
  runtime.mutations.add(mutationId); runtime.states.set(productId, state);
}

function enrichFixtureProduct(product: (typeof fixtureProducts)[number]): ProductView {
  return {
    ...product,
    scoutStores: targetFieldStores.map((store) => ({
      ...store,
      retailerKey: "target",
      retailer: "Target",
      actionLinks: retailerActionLinks({
        retailerKey: "target",
        retailerName: "Target",
        listingUrl: `https://www.target.com/s?searchTerm=${encodeURIComponent(product.name)}`,
        productName: product.name,
        identifiers: product.identifiers
      })
    })),
    listings: product.listings.map((listing) => ({
      ...listing,
      fieldStores: listing.retailerKey === "target" ? targetFieldStores : [],
      actionLinks: retailerActionLinks({
        retailerKey: listing.retailerKey,
        retailerName: listing.retailer,
        listingUrl: listing.url,
        productName: product.name,
        identifiers: product.identifiers
      })
    }))
  };
}
