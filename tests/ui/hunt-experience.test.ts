import { describe, expect, it } from "vitest";
import type { ProductView } from "@/features/catalog/view-model";
import {
  filterSignals,
  getHuntLeads,
  getProductDetail,
  getSignals,
  toDiscoverPresentation
} from "@/features/presentation/hunt-experience";

const product: ProductView = {
  id: "2d1f0d9e-06d4-4e61-b7f1-6d10442fda01",
  name: "NECA TMNT The Last Ronin Ultimate Leonardo",
  brand: "NECA",
  line: "The Last Ronin",
  productType: "Action Figure",
  imageUrl: null,
  firstDetectedAt: "2026-07-18T16:00:00.000Z",
  state: "HUNT",
  identifiers: [{ kind: "UPC", value: "634482541333" }],
  listing: { retailer: "Target", url: "https://www.target.com/p/-/A-91234567", priceMinor: 3499, status: "ACTIVE" },
  availability: [
    { status: "IN_STOCK", observedAt: "2026-07-18T16:00:00.000Z", storeName: "Target Fishers", sourceAvailable: true },
    { status: "SOURCE_UNAVAILABLE", observedAt: "2026-07-15T16:00:00.000Z", storeName: "Target Carmel", sourceAvailable: false }
  ]
};

describe("hunt experience presentation boundary", () => {
  it("adds retailer and match-review presentation without changing the catalog contract", () => {
    const presented = toDiscoverPresentation([product])[0];
    expect(presented?.retailers).toEqual(["Target", "Walmart", "Ross"]);
    expect(presented?.matchReview).toBe("needs-review");
  });

  it("orders store leads by existing ordinal ranking and exposes every factor", () => {
    const leads = getHuntLeads(product);
    expect(leads.map((lead) => lead.rank.label)).toEqual(["STRONG", "POSSIBLE", "WEAK"]);
    expect(leads[0]?.scopeLabel).toBe("Named local Ross");
    expect(leads.every((lead) => lead.rank.factors.length > 0)).toBe(true);
    expect(leads.flatMap((lead) => lead.rank.factors).some((factor) => factor.direction === "negative")).toBe(true);
  });

  it("filters Ross evidence to local scope without leaking national activity", () => {
    const rossLocal = filterSignals(getSignals([product]), {
      kind: "ross",
      retailer: "Ross",
      scope: "local",
      freshness: "all",
      product: "all"
    });
    expect(rossLocal.map((signal) => signal.scopeLabel)).toEqual(["Named local Ross"]);
    expect(rossLocal[0]?.description).toContain("not a retailer inventory claim");
  });

  it("represents a generic crowd sighting as local-area evidence", () => {
    const crowd = filterSignals(getSignals([product]), {
      kind: "crowd",
      retailer: "all",
      scope: "local",
      freshness: "all",
      product: "all"
    });
    expect(crowd.map((signal) => signal.scopeLabel)).toEqual(["Local area"]);
  });

  it("retains cached unavailable observations and sanitized detail excerpts", () => {
    const detail = getProductDetail(product);
    expect(detail.availabilityHistory.some((item) => !item.sourceAvailable)).toBe(true);
    expect(detail.sightings[0]?.excerpt).not.toContain("<script");
    expect(detail.matchReview.state).toBe("needs-review");
  });
});
