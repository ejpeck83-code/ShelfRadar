import { and, eq } from "drizzle-orm";
import type { ShelfRadarDb } from "@/db/client";
import { crowdPosts, productIdentifiers, products, retailers, sightingProductCandidates, sightings, stores } from "@/db/schema";
import type { RawCrowdPost } from "@/adapters/crowd/reddit";
import { buildEvidenceGroups, fingerprintCrowdPost } from "../dedup";
import { extractSighting, type CrowdTermConfig, type SightingExtraction } from ".";
import { matchSightingCandidates, type CrowdProductRecord, type SightingCandidate } from "./match-candidates";
import { ingestionIdempotencyKey } from "@/ingestion/run-discovery";
import type { IngestionRunRecord, IngestionRunRepository } from "@/ingestion/contracts";
import { finishPostgresIngestionRun, latestPostgresCheckpoint, startPostgresIngestionRun } from "@/db/repositories/postgres-ingestion-runs";

export type CrowdIngestionCounts = { fetched: number; postsCreated: number; sightingsCreated: number; duplicateEvidence: number; candidatesCreated: number };

export interface CrowdSightingRepository extends IngestionRunRepository {
  loadProductCandidates(): Promise<CrowdProductRecord[]>;
  persistPost(post: RawCrowdPost): Promise<{ id: string; created: boolean }>;
  persistSighting(input: { postId: string; extraction: SightingExtraction; evidenceGroupKey: string; candidates: readonly SightingCandidate[]; reviewRequired: boolean }): Promise<{ created: boolean; candidateCount: number }>;
}

export class PostgresCrowdSightingRepository implements CrowdSightingRepository {
  constructor(private readonly db: ShelfRadarDb) {}

  async startRun(input: { sourceKey: string; jobType: string; runKey: string; parserVersion: string; startedAt: Date }): Promise<IngestionRunRecord> {
    return startPostgresIngestionRun(this.db, input);
  }

  async finishRun(run: IngestionRunRecord): Promise<void> {
    await finishPostgresIngestionRun(this.db, run);
  }

  async latestCheckpoint(sourceKey: string, jobType: string): Promise<string | undefined> {
    return latestPostgresCheckpoint(this.db, sourceKey, jobType);
  }

  async loadProductCandidates(): Promise<CrowdProductRecord[]> {
    const productRows = await this.db.select({ id: products.id, canonicalName: products.canonicalName, brand: products.brand, line: products.line, characters: products.characters }).from(products);
    const identifierRows = await this.db.select({ productId: productIdentifiers.productId, kind: productIdentifiers.kind, valueNormalized: productIdentifiers.valueNormalized, namespace: productIdentifiers.namespace }).from(productIdentifiers);
    const identifiersByProduct = new Map<string, typeof identifierRows>();
    for (const identifier of identifierRows) {
      const existing = identifiersByProduct.get(identifier.productId) ?? [];
      existing.push(identifier);
      identifiersByProduct.set(identifier.productId, existing);
    }
    return productRows.map((product) => ({
      productId: product.id,
      canonicalName: product.canonicalName,
      aliases: [],
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.line ? { line: product.line } : {}),
      characters: product.characters,
      identifiers: (identifiersByProduct.get(product.id) ?? []).map((identifier) => ({
        kind: identifier.kind,
        valueNormalized: identifier.valueNormalized,
        ...(identifier.namespace.startsWith("global:") ? {} : { retailerKey: identifier.namespace.split(":")[0] })
      }))
    }));
  }

  async persistPost(post: RawCrowdPost): Promise<{ id: string; created: boolean }> {
    const fingerprint = fingerprintCrowdPost(post);
    const inserted = await this.db.insert(crowdPosts).values({
      sourceKey: post.provenance.sourceKey,
      externalPostId: post.externalPostId,
      permalink: post.permalink,
      community: post.community,
      title: post.title,
      bodyExcerpt: post.bodyExcerpt ?? null,
      authorDisplay: post.authorDisplay ?? null,
      postedAt: new Date(post.postedAt),
      fetchedAt: new Date(post.fetchedAt),
      contentHash: fingerprint.contentHash,
      parentOrCrosspostId: post.parentOrCrosspostId ?? null,
      mediaEvidence: post.mediaEvidence,
      rawSourceRef: post.provenance.rawRef
    }).onConflictDoNothing({ target: [crowdPosts.sourceKey, crowdPosts.externalPostId] }).returning({ id: crowdPosts.id });
    if (inserted[0]) return { id: inserted[0].id, created: true };
    const existing = (await this.db.select({ id: crowdPosts.id }).from(crowdPosts).where(and(eq(crowdPosts.sourceKey, post.provenance.sourceKey), eq(crowdPosts.externalPostId, post.externalPostId))).limit(1))[0];
    if (!existing) throw new Error("Unable to load replayed crowd post");
    return { id: existing.id, created: false };
  }

  async persistSighting(input: { postId: string; extraction: SightingExtraction; evidenceGroupKey: string; candidates: readonly SightingCandidate[]; reviewRequired: boolean }): Promise<{ created: boolean; candidateCount: number }> {
    const retailerId = input.extraction.retailerKey
      ? (await this.db.select({ id: retailers.id }).from(retailers).where(eq(retailers.key, input.extraction.retailerKey)).limit(1))[0]?.id
      : undefined;
    const storeMatches = retailerId && input.extraction.city
      ? await this.db.select({ id: stores.id }).from(stores).where(and(eq(stores.retailerId, retailerId), eq(stores.city, input.extraction.city))).limit(2)
      : [];
    const storeId = storeMatches.length === 1 ? storeMatches[0]!.id : undefined;
    const ambiguousStore = storeMatches.length > 1;
    const idempotencyKey = crowdSightingIdempotencyKey(input.evidenceGroupKey);
    const reviewStatus = input.reviewRequired || ambiguousStore ? "NEEDS_REVIEW" : input.extraction.reviewStatus;
    const confidenceReasons = input.reviewRequired || ambiguousStore
      ? [...new Set([...input.extraction.confidenceReasons, ...(input.reviewRequired ? ["PRODUCT_MAPPING_REVIEW_REQUIRED"] : []), ...(ambiguousStore ? ["AMBIGUOUS_STORE_MAPPING"] : [])])]
      : input.extraction.confidenceReasons;
    const inserted = await this.db.insert(sightings).values({
      crowdPostId: input.postId,
      retailerId: retailerId ?? null,
      storeId: storeId ?? null,
      locationScope: input.extraction.locationScope,
      locationText: input.extraction.locationText ?? null,
      city: input.extraction.city ?? null,
      region: input.extraction.region ?? null,
      observedAt: input.extraction.observedAt ? new Date(input.extraction.observedAt) : null,
      evidenceKind: input.extraction.evidenceKind,
      confidenceScore: input.extraction.confidenceScore,
      confidenceReasons,
      reviewStatus,
      idempotencyKey
    }).onConflictDoNothing({ target: sightings.idempotencyKey }).returning({ id: sightings.id });
    const sightingId = inserted[0]?.id ?? (await this.db.select({ id: sightings.id }).from(sightings).where(eq(sightings.idempotencyKey, idempotencyKey)).limit(1))[0]?.id;
    if (!sightingId) throw new Error("Unable to load replayed sighting");
    const savedCandidates = input.candidates.length
      ? await this.db.insert(sightingProductCandidates).values(input.candidates.map((candidate) => ({
        sightingId,
        productId: candidate.productId,
        matchType: candidate.matchType,
        score: candidate.score,
        reasonCodes: candidate.reasonCodes,
        confirmed: candidate.confirmed
      }))).onConflictDoNothing({ target: [sightingProductCandidates.sightingId, sightingProductCandidates.productId] }).returning({ productId: sightingProductCandidates.productId })
      : [];
    return { created: Boolean(inserted[0]), candidateCount: savedCandidates.length };
  }
}

export function crowdSightingIdempotencyKey(evidenceGroupKey: string): string {
  return ingestionIdempotencyKey(["reddit-sighting", evidenceGroupKey]);
}

export async function ingestCrowdPosts(input: { posts: readonly RawCrowdPost[]; repository: CrowdSightingRepository; terms: CrowdTermConfig; now: Date }): Promise<CrowdIngestionCounts> {
  const products = await input.repository.loadProductCandidates();
  const groups = buildEvidenceGroups(input.posts);
  const counts: CrowdIngestionCounts = { fetched: input.posts.length, postsCreated: 0, sightingsCreated: 0, duplicateEvidence: 0, candidatesCreated: 0 };
  for (const group of groups) {
    const savedPost = await input.repository.persistPost(group.post);
    if (savedPost.created) counts.postsCreated += 1;
    if (group.duplicateReason) counts.duplicateEvidence += 1;
    const extraction = extractSighting(group.post, input.terms, input.now);
    const matching = matchSightingCandidates(extraction, products);
    const savedSighting = await input.repository.persistSighting({ postId: savedPost.id, extraction, evidenceGroupKey: group.evidenceGroupKey, candidates: matching.candidates, reviewRequired: matching.reviewRequired });
    if (savedSighting.created) counts.sightingsCreated += 1;
    counts.candidatesCreated += savedSighting.candidateCount;
  }
  return counts;
}
