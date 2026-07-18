import type { RawListing } from "@/domain/adapters";
import { identifierNamespace, normalizeIdentifier } from "@/domain/identifiers";

export type MatchCandidate = {
  productId: string;
  identifiers: Array<{ kind: RawListing["identifiers"][number]["kind"]; valueNormalized: string; retailerKey?: string }>;
};

export type MatchDecision =
  | { kind: "create"; reason: "NO_EXACT_IDENTIFIER" | "TITLE_ONLY_NOT_ALLOWED" }
  | { kind: "match"; productId: string; reason: "EXACT_IDENTIFIER" }
  | { kind: "review"; candidateProductIds: string[]; reason: "CONFLICTING_EXACT_IDENTIFIERS" };

export function matchProduct(listing: RawListing, candidates: MatchCandidate[], retailerKey: string): MatchDecision {
  const exactProductIds = new Set<string>();
  for (const raw of listing.identifiers) {
    const normalized = normalizeIdentifier(raw.kind, raw.value);
    if (!normalized.valid || raw.confidence === "INFERRED") continue;
    const namespace = identifierNamespace(raw.kind, retailerKey);
    for (const candidate of candidates) {
      if (
        candidate.identifiers.some(
          (identifier) =>
            identifierNamespace(identifier.kind, identifier.retailerKey) === namespace &&
            identifier.valueNormalized === normalized.valueNormalized
        )
      ) {
        exactProductIds.add(candidate.productId);
      }
    }
  }
  if (exactProductIds.size > 1) {
    return { kind: "review", candidateProductIds: [...exactProductIds].sort(), reason: "CONFLICTING_EXACT_IDENTIFIERS" };
  }
  const productId = [...exactProductIds][0];
  if (productId) return { kind: "match", productId, reason: "EXACT_IDENTIFIER" };

  const hasTitleCandidate = candidates.length > 0;
  return { kind: "create", reason: hasTitleCandidate ? "TITLE_ONLY_NOT_ALLOWED" : "NO_EXACT_IDENTIFIER" };
}
