import type { RawListing } from "@/domain/adapters";
import type { MatchCandidate } from "@/matching/match-product";

export type IngestionCounts = { fetched: number; parsed: number; created: number; updated: number; ignored: number; failed: number };
export type IngestionRunRecord = {
  id: string;
  runKey: string;
  sourceKey: string;
  jobType: string;
  parserVersion: string;
  startedAt: Date;
  status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED";
  counts: IngestionCounts;
  cursor?: string;
  message?: string;
};

export interface IngestionRunRepository {
  startRun(input: { sourceKey: string; jobType: string; runKey: string; parserVersion: string; startedAt: Date }): Promise<IngestionRunRecord>;
  finishRun(run: IngestionRunRecord): Promise<void>;
  latestCheckpoint(sourceKey: string, jobType: string): Promise<string | undefined>;
}

export interface CatalogRepository extends IngestionRunRepository {
  findProductByExternalListing(sourceKey: string, externalId: string): Promise<string | null>;
  findMatchCandidates(listing: RawListing, retailerKey: string): Promise<MatchCandidate[]>;
  createProductFromListing(listing: RawListing): Promise<string>;
  touchProduct(productId: string, seenAt: Date): Promise<void>;
  upsertListing(productId: string, retailerKey: string, listing: RawListing): Promise<{ id: string; created: boolean }>;
  upsertIdentifiers(productId: string, retailerKey: string, listingId: string, listing: RawListing): Promise<void>;
  appendAvailability(listingId: string, retailerKey: string, listing: RawListing): Promise<number>;
  createMatchReview(input: { sourceKey: string; externalListingId: string; candidateProductIds: string[]; reasonCode: string }): Promise<void>;
}
