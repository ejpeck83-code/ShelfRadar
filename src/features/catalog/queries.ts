import { and, desc, eq, inArray } from "drizzle-orm";
import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { availabilityObservations, productIdentifiers, products, retailerListings, retailers, stores, userProductStates } from "@/db/schema";
import { getFixtureProduct, listFixtureProducts } from "./fixture-store";
import type { ProductView } from "./view-model";

const USER_ID = "local-owner";

export async function listProducts(): Promise<ProductView[]> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return listFixtureProducts();
  if (!env.DATABASE_URL) return [];
  const { db, client } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    const rows = await db.select({ product: products, state: userProductStates.state, listing: retailerListings, retailerName: retailers.name }).from(products)
      .leftJoin(userProductStates, and(eq(userProductStates.productId, products.id), eq(userProductStates.userId, USER_ID)))
      .innerJoin(retailerListings, eq(retailerListings.productId, products.id)).innerJoin(retailers, eq(retailers.id, retailerListings.retailerId)).orderBy(desc(products.firstDetectedAt));
    const productIds = rows.map((row) => row.product.id);
    const listingIds = rows.map((row) => row.listing.id);
    const [ids, observations] = await Promise.all([
      productIds.length ? db.select().from(productIdentifiers).where(inArray(productIdentifiers.productId, productIds)) : Promise.resolve([]),
      listingIds.length ? db.select({ observation: availabilityObservations, storeName: stores.name }).from(availabilityObservations).leftJoin(stores, eq(stores.id, availabilityObservations.storeId)).where(inArray(availabilityObservations.listingId, listingIds)).orderBy(desc(availabilityObservations.observedAt)) : Promise.resolve([])
    ]);
    return rows.map((row) => ({
      id: row.product.id, name: row.product.canonicalName, brand: row.product.brand ?? "Unknown brand", line: row.product.line ?? "Unknown line", productType: row.product.productType ?? "Collectible", imageUrl: row.product.primaryImageUrl, firstDetectedAt: row.product.firstDetectedAt.toISOString(), state: row.state ?? "NEW",
      identifiers: ids.filter((id) => id.productId === row.product.id).map((id) => ({ kind: id.kind, value: id.valueDisplay })),
      listing: { retailer: row.retailerName, url: row.listing.canonicalUrl, priceMinor: row.listing.priceMinor, status: row.listing.listingStatus },
      availability: observations.filter((item) => item.observation.listingId === row.listing.id).map((item) => ({ status: item.observation.status, observedAt: item.observation.observedAt.toISOString(), storeName: item.storeName ?? `${row.retailerName} online`, sourceAvailable: item.observation.status !== "SOURCE_UNAVAILABLE" }))
    }));
  } finally { await client.end(); }
}

export async function getProduct(id: string): Promise<ProductView | null> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return getFixtureProduct(id);
  return (await listProducts()).find((product) => product.id === id) ?? null;
}
