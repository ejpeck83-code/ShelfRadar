import { createHash } from "node:crypto";
import type { RawCrowdPost } from "@/adapters/crowd/reddit";

export type DuplicateReason = "CROSSPOST_PARENT" | "EXACT_CONTENT" | "NEAR_DUPLICATE";
export type EvidenceGroup = { post: RawCrowdPost; evidenceGroupKey: string; duplicateReason?: DuplicateReason };

export function fingerprintCrowdPost(post: RawCrowdPost): { contentHash: string; nearDuplicateHash: string; tokens: string[] } {
  const normalized = normalizeContent(`${post.title} ${post.bodyExcerpt ?? ""}`);
  const tokens = normalized.split(" ").filter((token) => token.length > 1);
  const uniqueTokens = [...new Set(tokens)].sort();
  return { contentHash: hash(normalized), nearDuplicateHash: hash(uniqueTokens.join(" ")), tokens: uniqueTokens };
}

export function isNearDuplicate(left: RawCrowdPost, right: RawCrowdPost, threshold = 0.78): boolean {
  const leftTokens = new Set(fingerprintCrowdPost(left).tokens);
  const rightTokens = new Set(fingerprintCrowdPost(right).tokens);
  return tokenSimilarity(leftTokens, rightTokens) >= threshold;
}

export function buildEvidenceGroups(posts: readonly RawCrowdPost[]): EvidenceGroup[] {
  const groups: EvidenceGroup[] = [];
  const tokenSets = new Map<string, Set<string>>();
  const byExternalId = new Map<string, string>();
  const byContentHash = new Map<string, string>();
  for (const post of posts) {
    const parentId = normalizeExternalId(post.parentOrCrosspostId);
    const fingerprint = fingerprintCrowdPost(post);
    let evidenceGroupKey = parentId ? byExternalId.get(parentId) ?? `reddit:${parentId}` : undefined;
    let duplicateReason: DuplicateReason | undefined = parentId ? "CROSSPOST_PARENT" : undefined;
    if (!evidenceGroupKey) {
      evidenceGroupKey = byContentHash.get(fingerprint.contentHash);
      if (evidenceGroupKey) duplicateReason = "EXACT_CONTENT";
    }
    if (!evidenceGroupKey) {
      const currentTokens = new Set(fingerprint.tokens);
      const near = groups.find((candidate) => tokenSimilarity(tokenSets.get(candidate.evidenceGroupKey) ?? new Set(), currentTokens) >= 0.78);
      if (near) {
        evidenceGroupKey = near.evidenceGroupKey;
        duplicateReason = "NEAR_DUPLICATE";
      }
    }
    evidenceGroupKey ??= `reddit:${post.externalPostId}`;
    byExternalId.set(post.externalPostId, evidenceGroupKey);
    byExternalId.set(post.sourceRecordKey, evidenceGroupKey);
    byContentHash.set(fingerprint.contentHash, evidenceGroupKey);
    tokenSets.set(evidenceGroupKey, new Set(fingerprint.tokens));
    groups.push({ post, evidenceGroupKey, ...(duplicateReason ? { duplicateReason } : {}) });
  }
  return groups;
}

function tokenSimilarity(leftTokens: ReadonlySet<string>, rightTokens: ReadonlySet<string>): number {
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / new Set([...leftTokens, ...rightTokens]).size;
}

function normalizeExternalId(value: string | undefined): string | undefined {
  return value?.replace(/^t3_/, "");
}

function normalizeContent(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b(?:cross ?post|repost|posted again)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
