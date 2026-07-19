import { describe, expect, it } from "vitest";
import { listFixtureProducts } from "@/features/catalog/fixture-store";
import { buildHuntLeads } from "@/features/hunts/queries";
import { listSignals } from "@/features/signals/queries";

describe("integrated fixture view models", () => {
  it("shows one canonical product with multiple retailer listings", () => {
    const product = listFixtureProducts()[0]!;
    expect(product.listings.map((listing) => listing.retailer)).toEqual(["Target", "Walmart", "NECA Store"]);
    expect(product.identifiers).toEqual(expect.arrayContaining([
      { kind: "UPC", value: "634482541333" },
      { kind: "WALMART_ITEM_ID", value: "147258369" }
    ]));
  });

  it("exposes sanitized Ross scopes without converting them to inventory", async () => {
    const result = await listSignals({ dataMode: "fixture", retailer: "ross" });
    expect(new Set(result.signals.map((signal) => signal.locationScope))).toEqual(new Set(["NAMED_STORE", "REGIONAL", "NATIONAL", "UNKNOWN"]));
    expect(result.signals.every((signal) => !signal.excerpt?.includes("<"))).toBe(true);
    expect(result.signals.every((signal) => signal.kind === "crowd_sighting")).toBe(true);
    expect(result.signals.filter((signal) => signal.locationLabel.includes("fishers"))).toHaveLength(1);
  });

  it("uses only the latest append-only observation for each store lead", () => {
    const product = structuredClone(listFixtureProducts()[0]!);
    product.listings[0]!.availability.unshift({ status: "OUT_OF_STOCK", observedAt: "2026-07-18T15:00:00.000Z", storeName: "Target Fishers", sourceAvailable: true });
    const leads = buildHuntLeads(product, { calculatedAt: new Date("2026-07-18T21:00:00.000Z") });
    expect(leads.filter((lead) => lead.name === "Target Fishers")).toHaveLength(1);
    expect(leads.find((lead) => lead.name === "Target Fishers")?.label).toBe("Possible lead");
  });

  it("builds transparent retail and crowd leads without probabilities", () => {
    const product = listFixtureProducts()[0]!;
    const leads = buildHuntLeads(product, { calculatedAt: new Date("2026-07-18T21:00:00.000Z"), includeFixtureCrowd: true });
    expect(leads.map((lead) => lead.name)).toEqual(expect.arrayContaining(["Target Fishers", "Ross Fishers report"]));
    expect(leads.every((lead) => lead.factors.length > 0)).toBe(true);
    expect(JSON.stringify(leads)).not.toMatch(/percent|probability|%/i);
  });

  it("breaks equal-score ties by stable lead name", () => {
    const product = structuredClone(listFixtureProducts()[0]!);
    product.listings[0]!.availability = [
      { status: "UNKNOWN", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Zionsville", sourceAvailable: false },
      { status: "UNKNOWN", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Carmel", sourceAvailable: false }
    ];
    product.listings = [product.listings[0]!];
    expect(buildHuntLeads(product, { calculatedAt: new Date("2026-07-18T21:00:00.000Z") }).map((lead) => lead.name)).toEqual(["Target Carmel", "Target Zionsville"]);
  });
});
