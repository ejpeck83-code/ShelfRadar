import type { IdentifierKind } from "@/domain/catalog";
import { normalizeIdentifier } from "@/domain/identifiers";
import type { RawCrowdPost } from "@/adapters/crowd/reddit";
import { extractLocation, type LocationScope } from "../location";
import { DEFAULT_CROWD_TERMS, type CrowdTermConfig } from "./terms";

export { DEFAULT_CROWD_TERMS, buildCrowdTermConfig, buildRedditQueryTerms } from "./terms";
export type { CrowdTermConfig } from "./terms";

export type IdentifierMention = { kind: IdentifierKind; value: string };
export type EvidenceKind = "EXACT_PRODUCT_PHOTO" | "EXACT_PRODUCT_TEXT" | "LINE_OR_WAVE_PHOTO" | "LINE_OR_WAVE_TEXT" | "GENERAL_RETAILER_ACTIVITY";
export type ReviewStatus = "AUTO_ACCEPTED" | "NEEDS_REVIEW" | "REJECTED";

export type SightingExtraction = {
  sourcePostId: string;
  postedAt: string;
  observedAt?: string;
  retailerKey?: string;
  retailerMentions: string[];
  namedStoreText?: string;
  locationScope: LocationScope;
  locationText?: string;
  city?: string;
  region?: string;
  mediaEvidence: RawCrowdPost["mediaEvidence"];
  evidenceKind: EvidenceKind;
  identifierMentions: IdentifierMention[];
  matchedProductAliases: string[];
  matchedLineBrandAliases: string[];
  matchedCharacterAliases: string[];
  confidenceScore: number;
  confidenceReasons: string[];
  reviewStatus: ReviewStatus;
};

export function extractSighting(post: RawCrowdPost, terms: CrowdTermConfig = DEFAULT_CROWD_TERMS, now: Date): SightingExtraction {
  const text = normalize(`${post.title} ${post.bodyExcerpt ?? ""}`);
  const retailerMentions = Object.entries(terms.retailerAliases)
    .filter(([, aliases]) => aliases.some((alias) => containsTerm(text, alias)))
    .map(([key]) => key)
    .sort();
  const retailerKey = retailerMentions.length === 1 ? retailerMentions[0] : undefined;
  const location = extractLocation(text, retailerKey, terms);
  const identifierMentions = extractIdentifiers(text, terms.identifierLabels);
  const matchedProductAliases = matchingTerms(text, terms.productAliases);
  const matchedLineBrandAliases = matchingTerms(text, terms.lineBrandAliases);
  const matchedCharacterAliases = matchingTerms(text, terms.characterAliases);
  const photo = post.mediaEvidence === "PHOTO_LINK";
  const exact = identifierMentions.length > 0 || matchedProductAliases.length > 0;
  const line = matchedLineBrandAliases.length > 0 || matchedCharacterAliases.length > 0;
  const evidenceKind: EvidenceKind = exact
    ? photo ? "EXACT_PRODUCT_PHOTO" : "EXACT_PRODUCT_TEXT"
    : line ? photo ? "LINE_OR_WAVE_PHOTO" : "LINE_OR_WAVE_TEXT"
    : "GENERAL_RETAILER_ACTIVITY";
  const reasons = [...location.reasonCodes];
  let score = 20;
  if (retailerKey) { score += 10; reasons.push("SINGLE_RETAILER_MATCH"); }
  if (retailerMentions.length > 1) { score -= 15; reasons.push("AMBIGUOUS_RETAILER_REVIEW"); }
  if (location.locationScope === "NAMED_STORE") { score += 25; reasons.push(retailerKey === "ross" ? "ROSS_NAMED_LOCAL_STORE" : "NAMED_LOCAL_STORE"); }
  else if (location.locationScope === "LOCAL_CITY") score += 15;
  else if (location.locationScope === "REGIONAL") score += 10;
  else if (location.locationScope === "NATIONAL") score += 5;
  else score -= 10;
  if (identifierMentions.length > 0) { score += 25; reasons.push("EXACT_IDENTIFIER"); }
  else if (matchedProductAliases.length > 0) { score += 15; reasons.push("EXACT_ALIAS_CANDIDATE"); }
  else if (line) { score += 5; reasons.push("LINE_OR_CHARACTER_ACTIVITY"); }
  if (photo) { score += 10; reasons.push("PHOTO_LINK_PRESENT"); }

  const observedAt = inferObservedAt(text, new Date(post.postedAt));
  if (observedAt) reasons.push("OBSERVED_TIME_FROM_POST_LANGUAGE");
  else { score -= 5; reasons.push("POSTED_TIME_ONLY"); }
  const ageHours = Math.max(0, (now.getTime() - new Date(post.postedAt).getTime()) / 3_600_000);
  if (ageHours > 72) { score -= 25; reasons.push("STALE_EVIDENCE"); }

  const reviewStatus: ReviewStatus = retailerMentions.length > 1 || location.ambiguous || location.locationScope === "UNKNOWN" || identifierMentions.length === 0
    ? "NEEDS_REVIEW"
    : "AUTO_ACCEPTED";
  return {
    sourcePostId: post.externalPostId,
    postedAt: post.postedAt,
    ...(observedAt ? { observedAt: observedAt.toISOString() } : {}),
    ...(retailerKey ? { retailerKey } : {}),
    retailerMentions,
    ...(location.locationScope === "NAMED_STORE" && location.locationText ? { namedStoreText: `${retailerKey ?? "store"}:${location.locationText}` } : {}),
    locationScope: location.locationScope,
    ...(location.locationText ? { locationText: location.locationText } : {}),
    ...(location.city ? { city: location.city } : {}),
    ...(location.region ? { region: location.region } : {}),
    mediaEvidence: post.mediaEvidence,
    evidenceKind,
    identifierMentions,
    matchedProductAliases,
    matchedLineBrandAliases,
    matchedCharacterAliases,
    confidenceScore: Math.max(0, Math.min(100, score)),
    confidenceReasons: [...new Set(reasons)],
    reviewStatus
  };
}

function extractIdentifiers(text: string, labels: CrowdTermConfig["identifierLabels"]): IdentifierMention[] {
  const found: IdentifierMention[] = [];
  for (const [rawKind, aliases] of Object.entries(labels)) {
    const kind = rawKind as IdentifierKind;
    const valuePattern = kind === "UPC" ? "(\\d{8}|\\d{12,14})" : kind === "GTIN13" ? "(\\d{13})" : kind === "DPCI" ? "([\\d-]{8,11})" : "([a-z0-9-]{4,30})";
    for (const alias of aliases) {
      const expression = new RegExp(`\\b${escapeRegex(normalize(alias)).replace(/ /g, "\\s+")}\\s*(?:#|:|is)?\\s*${valuePattern}\\b`, "gi");
      for (const match of text.matchAll(expression)) {
        const value = match[1]?.replace(kind === "DPCI" ? /\D/g : /\s/g, "");
        if (value) found.push({ kind, value });
      }
    }
  }
  return found
    .filter((mention) => normalizeIdentifier(mention.kind, mention.value).valid)
    .filter((mention, index, all) => all.findIndex((candidate) => candidate.kind === mention.kind && candidate.value === mention.value) === index);
}

function inferObservedAt(text: string, postedAt: Date): Date | undefined {
  if (/\b(today|this morning|this afternoon|tonight|just found|just saw)\b/.test(text)) return postedAt;
  if (/\byesterday\b/.test(text)) return new Date(postedAt.getTime() - 86_400_000);
  return undefined;
}

function matchingTerms(text: string, terms: readonly string[]): string[] {
  return terms.filter((term) => containsTerm(text, term));
}

function containsTerm(text: string, term: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(normalize(term))}(?:$|[^a-z0-9])`, "i").test(text);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
