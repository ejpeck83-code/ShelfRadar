import { describe, expect, it } from "vitest";
import { retailerActionLinks } from "@/features/retailer-links";

describe("retailer action links", () => {
  it("adds a listing link and public retailer search link without treating search as ingestion", () => {
    const links = retailerActionLinks({
      retailerKey: "target",
      retailerName: "Target",
      listingUrl: "https://www.target.com/p/-/A-91234567",
      productName: "NECA TMNT Leonardo",
      identifiers: [{ kind: "UPC", value: "634482541333" }]
    });
    expect(links).toEqual([
      { label: "Open Target", url: "https://www.target.com/p/-/A-91234567", kind: "listing" },
      { label: "Search Target", url: "https://www.target.com/s?searchTerm=634482541333", kind: "search" }
    ]);
  });
});
