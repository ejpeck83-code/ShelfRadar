import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { availabilityObservations, retailerListings, stores } from "@/db/schema";

export const manualFieldCheckSchema = z.object({
  productId: z.uuid(),
  listingId: z.uuid(),
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
    const listing = (await db.select().from(retailerListings).where(and(eq(retailerListings.id, input.listingId), eq(retailerListings.productId, input.productId))).limit(1))[0];
    if (!listing) throw new Error("Listing not found for product");
    if (input.storeId) {
      const store = (await db.select({ id: stores.id }).from(stores).where(and(eq(stores.id, input.storeId), eq(stores.retailerId, listing.retailerId))).limit(1))[0];
      if (!store) throw new Error("Store not found for listing retailer");
    }
    const inserted = await db.insert(availabilityObservations).values({
      listingId: input.listingId,
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

export function manualStatusLabel(status: ManualFieldCheckInput["status"]): string {
  return ({
    IN_STOCK: "Owner field check: saw this product",
    LIMITED: "Owner field check: saw limited quantity",
    OUT_OF_STOCK: "Owner field check: checked, none seen",
    UNKNOWN: "Owner field check: checked, uncertain"
  } as const)[status];
}
