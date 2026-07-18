import type { ProductView } from "./view-model";
import type { UserProductState } from "@/domain/catalog";

const fixtureProducts: ProductView[] = [
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda01", name: "NECA TMNT The Last Ronin Ultimate Leonardo", brand: "NECA", line: "The Last Ronin", productType: "Action Figure", imageUrl: "/products/fixture-last-ronin-leonardo.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "634482541333" }, { kind: "DPCI", value: "087-16-7921" }, { kind: "TCIN", value: "91234567" }],
    listing: { retailer: "Target", url: "https://www.target.com/p/-/A-91234567", priceMinor: 3499, status: "ACTIVE" },
    availability: [
      { status: "IN_STOCK", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Fishers", sourceAvailable: true },
      { status: "SOURCE_UNAVAILABLE", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Carmel", sourceAvailable: false }
    ]
  },
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda02", name: "Playmates TMNT Mutant Mayhem Sewer Lair Set", brand: "Playmates Toys", line: "Mutant Mayhem", productType: "Playset", imageUrl: "/products/fixture-mutant-mayhem-lair.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "043377834917" }, { kind: "DPCI", value: "087-06-7734" }, { kind: "TCIN", value: "92345678" }],
    listing: { retailer: "Target", url: "https://www.target.com/p/-/A-92345678", priceMinor: 5999, status: "ACTIVE" },
    availability: [{ status: "ONLINE_ONLY", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target online", sourceAvailable: true }]
  },
  {
    id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda03", name: "Super7 TMNT Ultimates Donatello", brand: "Super7", line: "Ultimates!", productType: "Action Figure", imageUrl: "/products/fixture-ultimates-donatello.png", firstDetectedAt: "2026-07-18T16:00:00.000Z", state: "NEW",
    identifiers: [{ kind: "UPC", value: "840049827543" }, { kind: "TCIN", value: "93456789" }],
    listing: { retailer: "Target", url: "https://www.target.com/p/-/A-93456789", priceMinor: 5499, status: "OUT_OF_STOCK" },
    availability: [{ status: "OUT_OF_STOCK", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Westfield", sourceAvailable: true }]
  }
];

type FixtureRuntime = { states: Map<string, UserProductState>; mutations: Set<string> };
const fixtureGlobal = globalThis as typeof globalThis & { __shelfRadarFixtureRuntime?: FixtureRuntime };
const runtime = fixtureGlobal.__shelfRadarFixtureRuntime ?? { states: new Map<string, UserProductState>(), mutations: new Set<string>() };
fixtureGlobal.__shelfRadarFixtureRuntime = runtime;

export function listFixtureProducts(): ProductView[] { return fixtureProducts.map((product) => ({ ...product, state: runtime.states.get(product.id) ?? product.state })); }
export function getFixtureProduct(id: string): ProductView | null { return listFixtureProducts().find((product) => product.id === id) ?? null; }
export function setFixtureProductState(productId: string, state: UserProductState, mutationId: string): void {
  if (runtime.mutations.has(mutationId)) return;
  if (!fixtureProducts.some((product) => product.id === productId)) throw new Error("Product not found");
  runtime.mutations.add(mutationId); runtime.states.set(productId, state);
}
