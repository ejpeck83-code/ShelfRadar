import { z } from "zod";

export const userProductStateSchema = z.enum(["NEW", "HUNT", "WATCH", "IGNORE", "OWN"]);
export const normalizationStatusSchema = z.enum(["CONFIRMED", "AUTO_MATCHED", "NEEDS_REVIEW"]);
export const identifierKindSchema = z.enum([
  "UPC",
  "GTIN12",
  "GTIN13",
  "EAN",
  "DPCI",
  "TCIN",
  "WALMART_ITEM_ID",
  "MEIJER_SKU",
  "RETAILER_SKU",
  "MANUFACTURER_SKU"
]);
export const identifierConfidenceSchema = z.enum(["EXACT", "CLAIMED", "PARSED", "INFERRED"]);
export const listingStatusSchema = z.enum(["ACTIVE", "PREORDER", "OUT_OF_STOCK", "REMOVED", "UNKNOWN"]);
export const availabilityStatusSchema = z.enum([
  "IN_STOCK",
  "LIMITED",
  "OUT_OF_STOCK",
  "PICKUP_UNAVAILABLE",
  "PREORDER",
  "ONLINE_ONLY",
  "UNKNOWN",
  "SOURCE_UNAVAILABLE"
]);

export const productIdentifierSchema = z.object({
  kind: identifierKindSchema,
  valueNormalized: z.string().min(1).max(128),
  valueDisplay: z.string().min(1).max(128),
  confidence: identifierConfidenceSchema,
  retailerKey: z.string().min(1).optional()
});

export const canonicalProductSchema = z.object({
  id: z.uuid(),
  canonicalName: z.string().min(1).max(300),
  franchise: z.literal("TMNT"),
  brand: z.string().max(120).nullable(),
  manufacturer: z.string().max(120).nullable(),
  line: z.string().max(120).nullable(),
  productType: z.string().max(80).nullable(),
  characters: z.array(z.string().min(1).max(100)),
  description: z.string().max(4_000).nullable(),
  primaryImageUrl: z.url().nullable(),
  firstDetectedAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  normalizationStatus: normalizationStatusSchema
});

export const classificationInputSchema = z.object({
  productId: z.uuid(),
  state: userProductStateSchema,
  mutationId: z.string().min(8).max(128)
});

export type UserProductState = z.infer<typeof userProductStateSchema>;
export type IdentifierKind = z.infer<typeof identifierKindSchema>;
export type ProductIdentifier = z.infer<typeof productIdentifierSchema>;
export type CanonicalProduct = z.infer<typeof canonicalProductSchema>;
