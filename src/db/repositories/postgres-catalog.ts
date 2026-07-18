import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { RawListing } from "@/domain/adapters";
import { identifierNamespace, normalizeIdentifier, type NormalizedIdentifier } from "@/domain/identifiers";
import type { CatalogRepository, IngestionRunRecord } from "@/ingestion/contracts";
import { ingestionIdempotencyKey } from "@/ingestion/run-discovery";
import type { MatchCandidate } from "@/matching/match-product";
import type { ShelfRadarDb } from "../client";
import { availabilityObservations, ingestionRuns, matchReviewItems, productIdentifiers, products, retailerListings, retailers, stores } from "../schema";

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(private readonly db: ShelfRadarDb) {}

  async startRun(input: { sourceKey: string; runKey: string; parserVersion: string; startedAt: Date }): Promise<IngestionRunRecord> {
    const inserted = await this.db.insert(ingestionRuns).values({ sourceKey: input.sourceKey, jobType: "product_discovery", startedAt: input.startedAt, status: "RUNNING", parserVersion: input.parserVersion, runKey: input.runKey }).onConflictDoNothing({ target: ingestionRuns.runKey }).returning();
    const row = inserted[0] ?? (await this.db.select().from(ingestionRuns).where(eq(ingestionRuns.runKey, input.runKey)).limit(1))[0];
    if (!row) throw new Error("Unable to create ingestion run");
    return runFromRow(row);
  }

  async finishRun(run: IngestionRunRecord): Promise<void> {
    await this.db.update(ingestionRuns).set({
      status: run.status, finishedAt: new Date(), fetchedCount: run.counts.fetched, parsedCount: run.counts.parsed, createdCount: run.counts.created,
      updatedCount: run.counts.updated, ignoredCount: run.counts.ignored, failedCount: run.counts.failed, sanitizedMessage: run.message?.slice(0, 500) ?? null
    }).where(eq(ingestionRuns.id, run.id));
  }

  async findProductByExternalListing(sourceKey: string, externalId: string): Promise<string | null> {
    const row = await this.db.select({ productId: retailerListings.productId }).from(retailerListings).innerJoin(retailers, eq(retailers.id, retailerListings.retailerId)).where(and(eq(retailers.key, sourceKey), eq(retailerListings.retailerProductId, externalId))).limit(1);
    return row[0]?.productId ?? null;
  }

  async findMatchCandidates(listing: RawListing, retailerKey: string): Promise<MatchCandidate[]> {
    const incoming: NormalizedIdentifier[] = listing.identifiers.map((item: RawListing["identifiers"][number]) => normalizeIdentifier(item.kind, item.value)).filter((item: NormalizedIdentifier) => item.valid);
    const rows = await this.db.select({ productId: productIdentifiers.productId, kind: productIdentifiers.kind, namespace: productIdentifiers.namespace, valueNormalized: productIdentifiers.valueNormalized }).from(productIdentifiers);
    const ids = new Set(rows.filter((row) => incoming.some((item: NormalizedIdentifier) => item.kind === row.kind && item.valueNormalized === row.valueNormalized && identifierNamespace(item.kind, retailerKey) === row.namespace)).map((row) => row.productId));
    return [...ids].map((productId) => ({
      productId,
      identifiers: rows.filter((row) => row.productId === productId).map((row) => ({ kind: row.kind, valueNormalized: row.valueNormalized, ...(row.namespace.startsWith("global:") ? {} : { retailerKey: row.namespace.split(":")[0] }) }))
    }));
  }

  async createProductFromListing(listing: RawListing): Promise<string> {
    const at = new Date(listing.provenance.fetchedAt);
    const row = await this.db.insert(products).values({ canonicalName: listing.title, franchise: "TMNT", brand: listing.brand ?? null, manufacturer: listing.manufacturer ?? null, line: listing.line ?? null, productType: listing.productType ?? null, characters: listing.characters, primaryImageUrl: listing.imageUrl ?? null, firstDetectedAt: at, lastSeenAt: at, normalizationStatus: "CONFIRMED" }).returning({ id: products.id });
    const id = row[0]?.id;
    if (!id) throw new Error("Unable to create product");
    return id;
  }

  async touchProduct(productId: string, seenAt: Date): Promise<void> { await this.db.update(products).set({ lastSeenAt: seenAt, updatedAt: new Date() }).where(eq(products.id, productId)); }

  async upsertListing(productId: string, retailerKey: string, listing: RawListing): Promise<{ id: string; created: boolean }> {
    const retailerId = await this.retailerId(retailerKey);
    const canonicalUrlHash = createHash("sha256").update(listing.canonicalUrl).digest("hex");
    const at = new Date(listing.provenance.fetchedAt);
    const inserted = await this.db.insert(retailerListings).values({ productId, retailerId, retailerProductId: listing.externalId, canonicalUrl: listing.canonicalUrl, canonicalUrlHash, title: listing.title, imageUrl: listing.imageUrl ?? null, currency: listing.currency, priceMinor: listing.priceMinor ?? null, listingStatus: listing.listingStatus, rawSourceRef: listing.provenance.rawRef, firstDetectedAt: at, lastCheckedAt: at, lastChangedAt: at }).onConflictDoNothing({ target: [retailerListings.retailerId, retailerListings.retailerProductId] }).returning({ id: retailerListings.id });
    if (inserted[0]) return { id: inserted[0].id, created: true };
    const existing = (await this.db.select({ id: retailerListings.id }).from(retailerListings).where(and(eq(retailerListings.retailerId, retailerId), eq(retailerListings.retailerProductId, listing.externalId))).limit(1))[0];
    if (!existing) throw new Error("Unable to load existing listing");
    await this.db.update(retailerListings).set({ title: listing.title, priceMinor: listing.priceMinor ?? null, listingStatus: listing.listingStatus, lastCheckedAt: at, updatedAt: new Date() }).where(eq(retailerListings.id, existing.id));
    return { id: existing.id, created: false };
  }

  async upsertIdentifiers(productId: string, retailerKey: string, listingId: string, listing: RawListing): Promise<void> {
    const retailerId = await this.retailerId(retailerKey);
    for (const raw of listing.identifiers) {
      const normalized = normalizeIdentifier(raw.kind, raw.value);
      if (!normalized.valid) continue;
      const namespace = identifierNamespace(raw.kind, retailerKey);
      const specific = !namespace.startsWith("global:");
      const at = new Date(listing.provenance.fetchedAt);
      await this.db.insert(productIdentifiers).values({ productId, kind: raw.kind, namespace, valueNormalized: normalized.valueNormalized, valueDisplay: normalized.valueDisplay, retailerId: specific ? retailerId : null, sourceListingId: listingId, confidence: raw.confidence, firstObservedAt: at, lastObservedAt: at }).onConflictDoUpdate({ target: [productIdentifiers.namespace, productIdentifiers.kind, productIdentifiers.valueNormalized], set: { lastObservedAt: at, updatedAt: new Date() } });
    }
  }

  async appendAvailability(listingId: string, retailerKey: string, listing: RawListing): Promise<number> {
    const retailerId = await this.retailerId(retailerKey);
    let count = 0;
    for (const observation of listing.availability) {
      const storeId = observation.retailerStoreId ? (await this.db.select({ id: stores.id }).from(stores).where(and(eq(stores.retailerId, retailerId), eq(stores.retailerStoreId, observation.retailerStoreId))).limit(1))[0]?.id : undefined;
      const idempotencyKey = ingestionIdempotencyKey([retailerKey, listing.externalId, observation.retailerStoreId ?? "online", observation.status, observation.observedAt]);
      const inserted = await this.db.insert(availabilityObservations).values({ listingId, storeId: storeId ?? null, status: observation.status, observedAt: new Date(observation.observedAt), sourceKind: retailerKey, sourceRef: listing.provenance.rawRef, parserVersion: listing.provenance.parserVersion, idempotencyKey, rawLabel: observation.rawLabel ?? null }).onConflictDoNothing({ target: availabilityObservations.idempotencyKey }).returning({ id: availabilityObservations.id });
      count += inserted.length;
    }
    return count;
  }

  async createMatchReview(input: { sourceKey: string; externalListingId: string; candidateProductIds: string[]; reasonCode: string }): Promise<void> {
    await this.db.insert(matchReviewItems).values({ sourceKey: input.sourceKey, externalListingId: input.externalListingId, candidateProductIds: input.candidateProductIds, reasonCode: input.reasonCode, details: {} }).onConflictDoNothing();
  }

  private async retailerId(key: string): Promise<string> {
    const row = (await this.db.select({ id: retailers.id }).from(retailers).where(eq(retailers.key, key)).orderBy(desc(retailers.createdAt)).limit(1))[0];
    if (!row) throw new Error(`Retailer is not seeded: ${key}`);
    return row.id;
  }
}

function runFromRow(row: typeof ingestionRuns.$inferSelect): IngestionRunRecord {
  return { id: row.id, runKey: row.runKey, sourceKey: row.sourceKey, status: row.status, counts: { fetched: row.fetchedCount, parsed: row.parsedCount, created: row.createdCount, updated: row.updatedCount, ignored: row.ignoredCount, failed: row.failedCount }, ...(row.sanitizedMessage ? { message: row.sanitizedMessage } : {}) };
}
