import type { RawListing } from "@/domain/adapters";
import type { IdentifierKind } from "@/domain/catalog";
import { matchProduct, type MatchCandidate } from "@/matching/match-product";
import type { SightingExtraction } from ".";

export type CrowdProductRecord = {
  productId: string;
  canonicalName: string;
  aliases: readonly string[];
  brand?: string;
  line?: string;
  characters?: readonly string[];
  identifiers: Array<{ kind: IdentifierKind; valueNormalized: string; retailerKey?: string }>;
};

export type SightingCandidate = {
  productId: string;
  matchType: "identifier" | "exact_alias" | "character_line" | "fuzzy_title";
  score: number;
  reasonCodes: string[];
  confirmed: boolean;
};

export function matchSightingCandidates(extraction: SightingExtraction, products: readonly CrowdProductRecord[]): { candidates: SightingCandidate[]; reviewRequired: boolean } {
  const rawListing: RawListing = {
    externalId: extraction.sourcePostId,
    title: [...extraction.matchedProductAliases, ...extraction.matchedLineBrandAliases, ...extraction.matchedCharacterAliases].join(" ") || "TMNT crowd sighting",
    canonicalUrl: `https://www.reddit.com/comments/${encodeURIComponent(extraction.sourcePostId)}`,
    characters: [],
    identifiers: extraction.identifierMentions.map((identifier) => ({ kind: identifier.kind, value: identifier.value, confidence: "PARSED" as const })),
    currency: "USD",
    listingStatus: "UNKNOWN",
    availability: [],
    provenance: { sourceKey: "reddit", externalId: extraction.sourcePostId, fetchedAt: extraction.postedAt, parserVersion: "reddit-sighting-v1", rawRef: `crowd:${extraction.sourcePostId}` }
  };
  const existingCandidates: MatchCandidate[] = products.map((product) => ({ productId: product.productId, identifiers: product.identifiers }));
  const exactDecision = matchProduct(rawListing, existingCandidates, extraction.retailerKey ?? "unknown");
  if (exactDecision.kind === "match") {
    return { candidates: [{ productId: exactDecision.productId, matchType: "identifier", score: 100, reasonCodes: ["EXACT_IDENTIFIER", "EXISTING_MATCH_SERVICE_EXACT_IDENTIFIER"], confirmed: true }], reviewRequired: false };
  }
  if (exactDecision.kind === "review") {
    return {
      candidates: exactDecision.candidateProductIds.map((productId) => ({ productId, matchType: "identifier", score: 100, reasonCodes: ["CONFLICTING_EXACT_IDENTIFIERS", "EXISTING_MATCH_SERVICE_REVIEW"], confirmed: false })),
      reviewRequired: true
    };
  }

  const text = normalize([extraction.matchedProductAliases, extraction.matchedLineBrandAliases, extraction.matchedCharacterAliases].flat().join(" "));
  const candidates: SightingCandidate[] = [];
  for (const product of products) {
    const aliases = [product.canonicalName, ...product.aliases].map(normalize).filter(Boolean);
    if (aliases.some((alias) => text.includes(alias) || extraction.matchedProductAliases.some((match) => normalize(match) === alias))) {
      candidates.push({ productId: product.productId, matchType: "exact_alias", score: 75, reasonCodes: ["CURATED_ALIAS_CANDIDATE", "ALIAS_MATCH_REQUIRES_REVIEW"], confirmed: false });
      continue;
    }
    const metadata = normalize([product.brand, product.line, ...(product.characters ?? [])].filter(Boolean).join(" "));
    const metadataScore = tokenSimilarity(text, metadata);
    if (metadataScore >= 0.5) {
      candidates.push({ productId: product.productId, matchType: "character_line", score: 55, reasonCodes: ["CHARACTER_LINE_CANDIDATE", "NON_IDENTIFIER_MATCH_REQUIRES_REVIEW"], confirmed: false });
      continue;
    }
    const titleScore = tokenSimilarity(text, normalize(product.canonicalName));
    if (titleScore >= 0.5) candidates.push({ productId: product.productId, matchType: "fuzzy_title", score: 35, reasonCodes: ["TITLE_SIMILARITY_ONLY", "TITLE_ONLY_NEVER_CONFIRMED"], confirmed: false });
  }
  candidates.sort((left, right) => right.score - left.score || left.productId.localeCompare(right.productId));
  return { candidates, reviewRequired: true };
}

function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
