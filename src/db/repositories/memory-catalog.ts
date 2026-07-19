import { randomUUID } from "node:crypto";
import type { RawListing } from "@/domain/adapters";
import { normalizeIdentifier, type NormalizedIdentifier } from "@/domain/identifiers";
import type { MatchCandidate } from "@/matching/match-product";
import { ingestionIdempotencyKey } from "@/ingestion/run-discovery";
import type { CatalogRepository, IngestionRunRecord } from "@/ingestion/contracts";

type MemoryProduct = { id: string; name: string; firstDetectedAt: Date; lastSeenAt: Date };
type MemoryListing = { id: string; productId: string; sourceKey: string; externalId: string; raw: RawListing };
type MemoryIdentifier = { productId: string; kind: RawListing["identifiers"][number]["kind"]; valueNormalized: string; retailerKey?: string };

export class MemoryCatalogRepository implements CatalogRepository {
  readonly products = new Map<string, MemoryProduct>();
  readonly listings = new Map<string, MemoryListing>();
  readonly identifiers: MemoryIdentifier[] = [];
  readonly observations = new Map<string, { listingId: string; status: string; observedAt: string }>();
  readonly runs = new Map<string, IngestionRunRecord>();
  readonly reviews = new Map<string, { candidateProductIds: string[]; reasonCode: string }>();

  async inTransaction<T>(operation: (repository: CatalogRepository) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async startRun(input: { sourceKey: string; jobType: string; runKey: string; parserVersion: string; startedAt: Date }): Promise<IngestionRunRecord> {
    const existing = this.runs.get(input.runKey);
    if (existing) return structuredClone(existing);
    const run: IngestionRunRecord = {
      id: randomUUID(), runKey: input.runKey, sourceKey: input.sourceKey, jobType: input.jobType, parserVersion: input.parserVersion, startedAt: input.startedAt, status: "RUNNING",
      counts: { fetched: 0, parsed: 0, created: 0, updated: 0, ignored: 0, failed: 0 }
    };
    this.runs.set(input.runKey, structuredClone(run));
    return run;
  }

  async finishRun(run: IngestionRunRecord): Promise<void> { this.runs.set(run.runKey, structuredClone(run)); }

  async latestCheckpoint(sourceKey: string, jobType: string): Promise<string | undefined> {
    return [...this.runs.values()]
      .filter((run) => run.sourceKey === sourceKey && run.jobType === jobType && run.status === "SUCCEEDED" && run.cursor)
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0]?.cursor;
  }

  async findProductByExternalListing(sourceKey: string, externalId: string): Promise<string | null> {
    return [...this.listings.values()].find((listing) => listing.sourceKey === sourceKey && listing.externalId === externalId)?.productId ?? null;
  }

  async findMatchCandidates(listing: RawListing, retailerKey: string): Promise<MatchCandidate[]> {
    const incoming: NormalizedIdentifier[] = listing.identifiers.map((identifier: RawListing["identifiers"][number]) => normalizeIdentifier(identifier.kind, identifier.value));
    const title = normalizeTitle(listing.title);
    return [...this.products.values()]
      .filter((product) => {
        if (normalizeTitle(product.name) === title) return true;
        return this.identifiers.some((saved) => saved.productId === product.id && incoming.some((item: NormalizedIdentifier) => item.valid && item.kind === saved.kind && item.valueNormalized === saved.valueNormalized));
      })
      .map((product) => ({ productId: product.id, identifiers: this.identifiers.filter((identifier) => identifier.productId === product.id).map((identifier) => ({ ...identifier, retailerKey: identifier.retailerKey ?? retailerKey })) }));
  }

  async createProductFromListing(listing: RawListing): Promise<string> {
    const id = randomUUID();
    const at = new Date(listing.provenance.fetchedAt);
    this.products.set(id, { id, name: listing.title, firstDetectedAt: at, lastSeenAt: at });
    return id;
  }

  async touchProduct(productId: string, seenAt: Date): Promise<void> {
    const product = this.products.get(productId);
    if (product && product.lastSeenAt < seenAt) product.lastSeenAt = seenAt;
  }

  async upsertListing(productId: string, retailerKey: string, listing: RawListing): Promise<{ id: string; created: boolean }> {
    const key = `${retailerKey}:${listing.externalId}`;
    const existing = this.listings.get(key);
    if (existing) { existing.raw = listing; return { id: existing.id, created: false }; }
    const id = randomUUID();
    this.listings.set(key, { id, productId, sourceKey: retailerKey, externalId: listing.externalId, raw: listing });
    return { id, created: true };
  }

  async upsertIdentifiers(productId: string, retailerKey: string, _listingId: string, listing: RawListing): Promise<void> {
    for (const raw of listing.identifiers) {
      const normalized = normalizeIdentifier(raw.kind, raw.value);
      if (!normalized.valid) continue;
      const retailerSpecific = ["DPCI", "TCIN", "WALMART_ITEM_ID", "MEIJER_SKU", "RETAILER_SKU"].includes(raw.kind);
      const retailer = retailerSpecific ? retailerKey : undefined;
      if (!this.identifiers.some((saved) => saved.productId === productId && saved.kind === raw.kind && saved.valueNormalized === normalized.valueNormalized && saved.retailerKey === retailer)) {
        this.identifiers.push({ productId, kind: raw.kind, valueNormalized: normalized.valueNormalized, ...(retailer ? { retailerKey: retailer } : {}) });
      }
    }
  }

  async appendAvailability(listingId: string, retailerKey: string, listing: RawListing): Promise<number> {
    let added = 0;
    for (const observation of listing.availability) {
      const key = ingestionIdempotencyKey([retailerKey, listing.externalId, observation.retailerStoreId ?? "online", observation.status, observation.observedAt]);
      if (!this.observations.has(key)) {
        this.observations.set(key, { listingId, status: observation.status, observedAt: observation.observedAt });
        added += 1;
      }
    }
    return added;
  }

  async createMatchReview(input: { sourceKey: string; externalListingId: string; candidateProductIds: string[]; reasonCode: string }): Promise<void> {
    this.reviews.set(`${input.sourceKey}:${input.externalListingId}:${input.reasonCode}`, { candidateProductIds: input.candidateProductIds, reasonCode: input.reasonCode });
  }
}

function normalizeTitle(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
