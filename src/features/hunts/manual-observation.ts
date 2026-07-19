import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { availabilityObservations, products, retailerListings, retailers, stores } from "@/db/schema";

export const manualFieldCheckSchema = z.object({
  productId: z.uuid(),
  listingId: z.uuid().optional(),
  retailerKey: z.enum(["target", "walmart", "meijer"]).default("target"),
  storeId: z.uuid().optional(),
  status: z.enum(["IN_STOCK", "LIMITED", "OUT_OF_STOCK", "UNKNOWN"]),
  note: z.string().trim().max(160).optional(),
  mutationId: z.uuid()
});

export type ManualFieldCheckInput = z.infer<typeof manualFieldCheckSchema>;

export async function recordManualFieldCheck(input: ManualFieldCheckInput, now = new Date()): Promise<"recorded" | "duplicate" | "fixture-readonly"> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return "fixture-readonly";
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required for manual field checks");
  const { db, client } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    const listing = await resolveManualListing(input, db);
    if (input.storeId) {
      const store = (await db.select({ id: stores.id }).from(stores).where(and(eq(stores.id, input.storeId), eq(stores.retailerId, listing.retailerId))).limit(1))[0];
      if (!store) throw new Error("Store not found for listing retailer");
    }
    const inserted = await db.insert(availabilityObservations).values({
      listingId: listing.id,
      storeId: input.storeId ?? null,
      status: input.status,
      observedAt: now,
      sourceKind: "owner_manual_field_check",
      sourceRef: `owner-manual:${input.mutationId}`,
      parserVersion: "manual-v1",
      idempotencyKey: `owner-manual:${input.mutationId}`,
      rawLabel: input.note || manualStatusLabel(input.status)
    }).onConflictDoNothing({ target: availabilityObservations.idempotencyKey }).returning({ id: availabilityObservations.id });
    return inserted.length ? "recorded" : "duplicate";
  } finally {
    await client.end();
  }
}

async function resolveManualListing(input: ManualFieldCheckInput, db: ReturnType<typeof createDatabase>["db"]): Promise<{ id: string; retailerId: string }> {
  if (input.listingId) {
    const listing = (await db.select({ id: retailerListings.id, retailerId: retailerListings.retailerId }).from(retailerListings).where(and(eq(retailerListings.id, input.listingId), eq(retailerListings.productId, input.productId))).limit(1))[0];
    if (!listing) throw new Error("Listing not found for product");
    return listing;
  }
  const [product, retailer] = await Promise.all([
    db.select({ name: products.canonicalName, imageUrl: products.primaryImageUrl }).from(products).where(eq(products.id, input.productId)).limit(1),
    db.select({ id: retailers.id, name: retailers.name, key: retailers.key }).from(retailers).where(eq(retailers.key, input.retailerKey)).limit(1)
  ]);
  const productRow = product[0];
  const retailerRow = retailer[0];
  if (!productRow || !retailerRow) throw new Error("Product or retailer not found for manual scout listing");
  const manualKey = `owner-manual-listing:${input.productId}:${retailerRow.key}`;
  const canonicalUrl = publicSearchUrl(retailerRow.key, productRow.name);
  const canonicalUrlHash = hash(manualKey);
  const now = new Date();
  const inserted = await db.insert(retailerListings).values({
    productId: input.productId,
    retailerId: retailerRow.id,
    canonicalUrl,
    canonicalUrlHash,
    title: `${productRow.name} (${retailerRow.name} manual scout)`,
    imageUrl: productRow.imageUrl,
    listingStatus: "UNKNOWN",
    rawSourceRef: manualKey,
    firstDetectedAt: now,
    lastCheckedAt: now,
    lastChangedAt: now
  }).onConflictDoNothing({ target: [retailerListings.retailerId, retailerListings.canonicalUrlHash] }).returning({ id: retailerListings.id, retailerId: retailerListings.retailerId });
  if (inserted[0]) return inserted[0];
  const existing = (await db.select({ id: retailerListings.id, retailerId: retailerListings.retailerId }).from(retailerListings).where(and(eq(retailerListings.retailerId, retailerRow.id), eq(retailerListings.canonicalUrlHash, canonicalUrlHash))).limit(1))[0];
  if (!existing) throw new Error("Unable to resolve manual scout listing");
  return existing;
}

function publicSearchUrl(retailerKey: string, query: string): string {
  if (retailerKey === "walmart") return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
  if (retailerKey === "meijer") return `https://www.meijer.com/shopping/search.html?text=${encodeURIComponent(query)}`;
  return `https://www.target.com/s?searchTerm=${encodeURIComponent(query)}`;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function manualStatusLabel(status: ManualFieldCheckInput["status"]): string {
  return ({
    IN_STOCK: "Owner field check: saw this product",
    LIMITED: "Owner field check: saw limited quantity",
    OUT_OF_STOCK: "Owner field check: checked, none seen",
    UNKNOWN: "Owner field check: checked, uncertain"
  } as const)[status];
}
