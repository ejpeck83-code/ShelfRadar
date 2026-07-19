import type { LocationTerm } from "../location";
import type { IdentifierKind } from "@/domain/catalog";

export type CrowdTermConfig = {
  tmntTerms: readonly string[];
  characterAliases: readonly string[];
  productAliases: readonly string[];
  lineBrandAliases: readonly string[];
  retailerAliases: Readonly<Record<string, readonly string[]>>;
  identifierLabels: Readonly<Partial<Record<IdentifierKind, readonly string[]>>>;
  localLocations: readonly LocationTerm[];
  regionalLocations: readonly LocationTerm[];
};

type CrowdTermInput = Partial<CrowdTermConfig>;
const TERM_SET_LIMIT = 100;

const defaults: CrowdTermConfig = {
  tmntTerms: ["TMNT", "Teenage Mutant Ninja Turtles", "Ninja Turtles"],
  characterAliases: ["Leonardo", "Donatello", "Raphael", "Michelangelo", "Shredder", "Splinter", "April O'Neil", "Casey Jones"],
  productAliases: ["Last Ronin Raphael", "Last Ronin Michelangelo", "Pizza Club Michelangelo"],
  lineBrandAliases: ["NECA TMNT", "NECA", "Last Ronin", "Mutant Mayhem", "TMNT GI Joe", "cartoon line", "Mirage Comics"],
  retailerAliases: {
    ross: ["Ross", "Ross Dress for Less", "Ross Finds"],
    target: ["Target"],
    walmart: ["Walmart", "Wal-Mart"],
    meijer: ["Meijer"],
    neca: ["NECA Store"]
  },
  identifierLabels: {
    UPC: ["UPC"],
    GTIN13: ["GTIN", "GTIN13"],
    DPCI: ["DPCI"],
    TCIN: ["TCIN"],
    WALMART_ITEM_ID: ["Walmart item", "Walmart item ID"],
    MEIJER_SKU: ["Meijer SKU"],
    MANUFACTURER_SKU: ["manufacturer SKU"]
  },
  localLocations: [
    { term: "Indianapolis", city: "Indianapolis", region: "IN" },
    { term: "Indy", city: "Indianapolis", region: "IN" },
    { term: "Fishers", city: "Fishers", region: "IN" },
    { term: "Carmel", city: "Carmel", region: "IN" },
    { term: "Westfield", city: "Westfield", region: "IN" },
    { term: "Castleton", city: "Indianapolis", region: "IN" },
    { term: "Noblesville", city: "Noblesville", region: "IN" },
    { term: "Indiana", region: "IN" }
  ],
  regionalLocations: [
    { term: "Cincinnati", city: "Cincinnati", region: "OH" },
    { term: "Louisville", city: "Louisville", region: "KY" }
  ]
};

export function buildCrowdTermConfig(input: CrowdTermInput = {}): CrowdTermConfig {
  const retailerAliases = input.retailerAliases ?? defaults.retailerAliases;
  const identifierLabels = input.identifierLabels ?? defaults.identifierLabels;
  if (Object.keys(retailerAliases).length > 20) throw new Error("Retailer alias keys must remain bounded to 20");
  if (Object.keys(identifierLabels).length > 20) throw new Error("Identifier label keys must remain bounded to 20");
  const normalizedRetailers = Object.fromEntries(Object.entries(retailerAliases).map(([key, values]) => [normalizeTerm(key), boundedTerms(values, `retailer:${key}`)]));
  return {
    tmntTerms: boundedTerms(input.tmntTerms ?? defaults.tmntTerms, "TMNT terms"),
    characterAliases: boundedTerms(input.characterAliases ?? defaults.characterAliases, "character aliases"),
    productAliases: boundedTerms(input.productAliases ?? defaults.productAliases, "product aliases"),
    lineBrandAliases: boundedTerms(input.lineBrandAliases ?? defaults.lineBrandAliases, "line/brand aliases"),
    retailerAliases: normalizedRetailers,
    identifierLabels: Object.fromEntries(Object.entries(identifierLabels).map(([kind, values]) => [kind, boundedTerms(values, `identifier:${kind}`)])),
    localLocations: boundedLocations(input.localLocations ?? defaults.localLocations, "local locations"),
    regionalLocations: boundedLocations(input.regionalLocations ?? defaults.regionalLocations, "regional locations")
  };
}

export const DEFAULT_CROWD_TERMS = buildCrowdTermConfig();

export function buildRedditQueryTerms(config: CrowdTermConfig = DEFAULT_CROWD_TERMS): string[] {
  return boundedTerms([
    ...config.tmntTerms,
    ...config.characterAliases,
    ...config.productAliases,
    ...config.lineBrandAliases,
    ...Object.values(config.retailerAliases).flat(),
    ...Object.values(config.identifierLabels).flat(),
    ...config.localLocations.map((location) => location.term),
    ...config.regionalLocations.map((location) => location.term)
  ], "combined Reddit query terms");
}

function boundedTerms(values: readonly string[], label: string): string[] {
  const normalized = [...new Set(values.map(normalizeTerm).filter(Boolean))];
  if (normalized.length > TERM_SET_LIMIT) throw new Error(`${label} must remain bounded to ${TERM_SET_LIMIT}`);
  return normalized;
}

function boundedLocations(values: readonly LocationTerm[], label: string): LocationTerm[] {
  if (values.length > TERM_SET_LIMIT) throw new Error(`${label} must remain bounded to ${TERM_SET_LIMIT}`);
  return values.map((location) => ({ ...location, term: normalizeTerm(location.term) })).filter((location) => location.term.length > 0);
}

function normalizeTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9']+/g, " ").trim();
}
