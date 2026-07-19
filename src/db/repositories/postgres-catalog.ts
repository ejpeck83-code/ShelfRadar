import { createHash } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import type { RawListing } from "@/domain/adapters";
import { identifierNamespace, normalizeIdentifier, type NormalizedIdentifier } from "@/domain/identifiers";
import type { CatalogRepository, IngestionRunRecord } from "@/ingestion/contracts";
import { ingestionIdempotencyKey } from "@/ingestion/run-discovery";
import type { MatchCandidate } from "@/matching/match-product";
import type { ShelfRadarQueryDb } from "../client";
import { availabilityObservations, matchReviewItems, productIdentifiers, products, retailerListings, retailers, stores } from "../schema";
import { finishPostgresIngestionRun, latestPostgresCheckpoint, startPostgresIngestionRun } from "./postgres-ingestion-runs";

export class PostgresCatalogRepository implements CatalogRepository {
  private readonly retailerIds = new Map<string, string>();

  constructor(private readonly db: ShelfRadarQueryDb) {}

  async inTransaction<T>(operation: (repository: CatalogRepository) => Promise<T>): Promise<T> {
    if (!("$client" in this.db)) return operation(this);
    return this.db.transaction(async (transaction) => operation(new PostgresCatalogRepository(transaction)));
  }

  async startRun(input: { sourceKey: string; jobType: string; runKey: string; parserVersion: string; startedAt: Date }): Promise<IngestionRunRecord> {
    return startPostgresIngestionRun(this.db, input);
  }

  async finishRun(run: IngestionRunRecord): Promise<void> {
    await finishPostgresIngestionRun(this.db, run);
  }

  async latestCheckpoint(sourceKey: string, jobType: string): Promise<string | undefined> {
    return latestPostgresCheckpoint(this.db, sourceKey, jobType);
  }

  async findProductByExternalListing(sourceKey: string, externalId: string): Promise<string | null> {
    const row = await this.db.select({ productId: retailerListings.productId }).from(retailerListings).innerJoin(retailers, eq(retailers.id, retailerListings.retailerId)).where(and(eq(retailers.key, sourceKey), eq(retailerListings.retailerProductId, externalId))).limit(1);
    return row[0]?.productId ?? null;
  }

  async findMatchCandidates(listing: RawListing, retailerKey: string): Promise<MatchCandidate[]> {
    const incoming: NormalizedIdentifier[] = listing.identifiers.map((item: RawListing["identifiers"][number]) => normalizeIdentifier(item.kind, item.value)).filter((item: NormalizedIdentifier) => item.valid);
    if (!incoming.length) return [];
    const rows = await this.db.select({ productId: productIdentifiers.productId, kind: productIdentifiers.kind, namespace: productIdentifiers.namespace, valueNormalized: productIdentifiers.valueNormalized }).from(productIdentifiers).where(or(...incoming.map((item) => and(
      eq(productIdentifiers.kind, item.kind),
      eq(productIdentifiers.valueNormalized, item.valueNormalized),
      eq(productIdentifiers.namespace, identifierNamespace(item.kind, retailerKey))
    ))));
    const ids = new Set(rows.map((row) => row.productId));
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
    const cached = this.retailerIds.get(key);
    if (cached) return cached;
    const row = (await this.db.select({ id: retailers.id }).from(retailers).where(eq(retailers.key, key)).orderBy(desc(retailers.createdAt)).limit(1))[0];
    if (!row) throw new Error(`Retailer is not seeded: ${key}`);
    this.retailerIds.set(key, row.id);
    return row.id;
  }
}
