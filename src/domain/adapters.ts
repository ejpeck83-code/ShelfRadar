import { z } from "zod";
import { availabilityStatusSchema, identifierKindSchema, listingStatusSchema } from "./catalog";

export const adapterCapabilitySchema = z.enum(["product_discovery", "listing_detail", "store_availability", "crowd_posts"]);

export const httpUrlSchema = z.string().max(2_048).refine((value) => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, "must be an HTTP(S) URL");

export const rawIdentifierSchema = z.object({
  kind: identifierKindSchema,
  value: z.string().min(1).max(128),
  confidence: z.enum(["EXACT", "CLAIMED", "PARSED", "INFERRED"]).default("CLAIMED")
});

export const provenanceSchema = z.object({
  sourceKey: z.string().min(1),
  externalId: z.string().min(1),
  fetchedAt: z.iso.datetime(),
  parserVersion: z.string().min(1),
  rawRef: z.string().min(1).max(300)
});

export const rawListingSchema = z.object({
  externalId: z.string().min(1).max(128),
  title: z.string().min(1).max(300),
  canonicalUrl: httpUrlSchema,
  imageUrl: httpUrlSchema.optional(),
  brand: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  line: z.string().max(120).optional(),
  productType: z.string().max(80).optional(),
  characters: z.array(z.string().max(100)).default([]),
  identifiers: z.array(rawIdentifierSchema).max(30),
  currency: z.string().length(3).default("USD"),
  priceMinor: z.number().int().nonnegative().optional(),
  listingStatus: listingStatusSchema.default("UNKNOWN"),
  availability: z
    .array(
      z.object({
        retailerStoreId: z.string().optional(),
        status: availabilityStatusSchema,
        observedAt: z.iso.datetime(),
        rawLabel: z.string().max(200).optional()
      })
    )
    .default([]),
  provenance: provenanceSchema
});

export type AdapterCapability = z.infer<typeof adapterCapabilitySchema>;
export type RawListing = z.infer<typeof rawListingSchema>;

export type AdapterResult<T> =
  | { kind: "success"; items: T[]; fetchedAt: string; nextCursor?: string }
  | { kind: "unavailable"; reason: string; retryAfter?: string }
  | { kind: "throttled"; retryAfter?: string }
  | { kind: "malformed"; reason: string; rawRef?: string };

export type DiscoveryQuery = { terms: string[]; cursor?: string; pageLimit: number };
export const listingQuerySchema = z.object({ externalId: z.string().min(1).max(128) });
export type ListingQuery = z.infer<typeof listingQuerySchema>;
export type AdapterContext = { signal: AbortSignal; requestId: string; now: Date };

export interface RetailDiscoveryAdapter {
  readonly sourceKey: string;
  readonly parserVersion?: string;
  readonly capabilities: readonly AdapterCapability[];
  discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>>;
  fetchListing?(query: ListingQuery, context: AdapterContext): Promise<AdapterResult<RawListing>>;
}
