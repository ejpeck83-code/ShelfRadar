export type LocationScope = "NAMED_STORE" | "LOCAL_CITY" | "REGIONAL" | "NATIONAL" | "UNKNOWN";

export type LocationTerm = { term: string; city?: string; region?: string };
export type LocationConfig = { localLocations: readonly LocationTerm[]; regionalLocations: readonly LocationTerm[] };
export type LocationExtraction = {
  locationScope: LocationScope;
  locationText?: string;
  city?: string;
  region?: string;
  ambiguous: boolean;
  reasonCodes: string[];
};

const NATIONAL_PATTERNS = ["nationwide", "national activity", "across the country", "all over the country"];

export function extractLocation(text: string, retailerKey: string | undefined, config: LocationConfig): LocationExtraction {
  const normalized = normalize(text);
  const localMatches = matchingTerms(normalized, config.localLocations);
  const regionalMatches = matchingTerms(normalized, config.regionalLocations);
  const national = NATIONAL_PATTERNS.some((pattern) => normalized.includes(pattern));
  const specificLocal = localMatches.find((location) => location.city) ?? localMatches[0];
  const matchedCities = localMatches.map((location) => location.city).filter((city): city is string => Boolean(city));
  const ambiguous = new Set(matchedCities).size > 1;

  if (specificLocal) {
    const namedStore = retailerKey ? hasNamedStoreLanguage(normalized, retailerKey, specificLocal.term) : false;
    return {
      locationScope: namedStore ? "NAMED_STORE" : "LOCAL_CITY",
      locationText: specificLocal.term,
      ...(specificLocal.city ? { city: specificLocal.city } : {}),
      ...(specificLocal.region ? { region: specificLocal.region } : {}),
      ambiguous,
      reasonCodes: [namedStore ? "NAMED_STORE_LOCATION" : "LOCAL_LOCATION_TERM", ...(ambiguous ? ["AMBIGUOUS_LOCAL_LOCATION"] : [])]
    };
  }
  const regional = regionalMatches[0];
  if (regional) {
    return {
      locationScope: "REGIONAL",
      locationText: regional.term,
      ...(regional.city ? { city: regional.city } : {}),
      ...(regional.region ? { region: regional.region } : {}),
      ambiguous: regionalMatches.length > 1,
      reasonCodes: ["REGIONAL_LOCATION_TERM", ...(regionalMatches.length > 1 ? ["AMBIGUOUS_REGIONAL_LOCATION"] : [])]
    };
  }
  if (national) return { locationScope: "NATIONAL", ambiguous: false, reasonCodes: ["NATIONAL_LOCATION_LANGUAGE", "NATIONAL_SIGNAL_NOT_LOCAL"] };
  return { locationScope: "UNKNOWN", ambiguous: false, reasonCodes: ["LOCATION_UNKNOWN_REVIEW"] };
}

function hasNamedStoreLanguage(text: string, retailerKey: string, locationTerm: string): boolean {
  const retailer = retailerKey === "ross" ? "ross" : retailerKey;
  const location = normalize(locationTerm);
  const patterns = [
    `${retailer} in ${location}`,
    `${retailer} at ${location}`,
    `${retailer} by `,
    `${retailer} on `,
    `${retailer} ${location}`,
    `at the ${retailer}`
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

function matchingTerms(text: string, terms: readonly LocationTerm[]): LocationTerm[] {
  return terms.filter((location) => new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalize(location.term))}(?:$|[^a-z0-9])`, "i").test(text));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
