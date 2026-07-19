import { z } from "zod";
import { availabilityStatusSchema, identifierKindSchema, listingStatusSchema } from "./catalog";

export const adapterCapabilitySchema = z.enum(["product_discovery", "listing_detail", "store_availability", "crowd_posts"]);

export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
    if (hostname.includes(":") && (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:"))) return false;
    const octets = hostname.split(".").map(Number);
    if (octets.length === 4 && octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = octets as [number, number, number, number];
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const httpUrlSchema = z.string().max(2_048).refine(isPublicHttpUrl, "must be a public HTTP(S) URL without embedded credentials");

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

export const rawCrowdPostSchema = z.object({
  externalPostId: z.string().min(1).max(128),
  sourceRecordKey: z.string().min(1).max(140),
  permalink: httpUrlSchema,
  community: z.string().min(1).max(100),
  title: z.string().min(1).max(500),
  bodyExcerpt: z.string().max(500).optional(),
  authorDisplay: z.string().max(120).optional(),
  postedAt: z.iso.datetime(),
  fetchedAt: z.iso.datetime(),
  parentOrCrosspostId: z.string().max(140).optional(),
  mediaEvidence: z.enum(["NONE", "PHOTO_LINK", "VIDEO_LINK", "UNKNOWN"]),
  mediaUrl: httpUrlSchema.optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: provenanceSchema
});

export type RawCrowdPost = z.infer<typeof rawCrowdPostSchema>;

export type AdapterResult<T> =
  | { kind: "success"; items: T[]; fetchedAt: string; nextCursor?: string }
  | { kind: "unavailable"; reason: string; retryAfter?: string }
  | { kind: "throttled"; retryAfter?: string }
  | { kind: "malformed"; reason: string; rawRef?: string };

export type DiscoveryQuery = { terms: string[]; cursor?: string; pageLimit: number };
export const listingQuerySchema = z.object({ externalId: z.string().min(1).max(128) });
export type ListingQuery = z.infer<typeof listingQuerySchema>;
export const crowdQuerySchema = z.object({
  terms: z.array(z.string().min(1).max(120)).max(100),
  checkpoint: z.string().max(500).optional(),
  pageLimit: z.number().int().min(1).max(20),
  pageSize: z.number().int().min(1).max(100).optional()
});
export type CrowdQuery = z.infer<typeof crowdQuerySchema>;
export type AdapterContext = { signal: AbortSignal; requestId: string; now: Date };

export interface RetailDiscoveryAdapter {
  readonly sourceKey: string;
  readonly parserVersion?: string;
  readonly capabilities: readonly AdapterCapability[];
  discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>>;
  fetchListing?(query: ListingQuery, context: AdapterContext): Promise<AdapterResult<RawListing>>;
}

export interface CrowdSourceAdapter {
  readonly sourceKey: string;
  readonly parserVersion?: string;
  readonly capabilities: readonly AdapterCapability[];
  fetchPosts(query: CrowdQuery, context: AdapterContext): Promise<AdapterResult<RawCrowdPost>>;
}
