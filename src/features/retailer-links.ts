import type { RetailerActionLink } from "@/features/catalog/view-model";

type RetailerLinkInput = {
  retailerKey: string;
  retailerName: string;
  listingUrl: string;
  productName: string;
  identifiers: Array<{ kind: string; value: string }>;
};

const SEARCH_URLS: Record<string, (query: string) => string> = {
  target: (query) => `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`,
  walmart: (query) => `https://www.walmart.com/search?q=${encodeURIComponent(query)}`,
  meijer: (query) => `https://www.meijer.com/shopping/search.html?text=${encodeURIComponent(query)}`,
  neca: (query) => `https://store.necaonline.com/search?q=${encodeURIComponent(query)}`
};

export function retailerActionLinks(input: RetailerLinkInput): RetailerActionLink[] {
  const links: RetailerActionLink[] = [{ label: `Open ${input.retailerName}`, url: input.listingUrl, kind: "listing" }];
  const query = preferredSearchQuery(input.productName, input.identifiers);
  const searchUrl = SEARCH_URLS[input.retailerKey]?.(query);
  if (searchUrl && searchUrl !== input.listingUrl) links.push({ label: `Search ${input.retailerName}`, url: searchUrl, kind: "search" });
  return links;
}

function preferredSearchQuery(productName: string, identifiers: Array<{ kind: string; value: string }>): string {
  const upc = identifiers.find((identifier) => ["UPC", "GTIN12", "GTIN13", "EAN"].includes(identifier.kind));
  return upc?.value ?? productName;
}
