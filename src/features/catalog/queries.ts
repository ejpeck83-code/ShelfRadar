import { and, desc, eq, inArray } from "drizzle-orm";
import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { availabilityObservations, productIdentifiers, products, retailerListings, retailers, stores, userProductStates } from "@/db/schema";
import { getFixtureProduct, listFixtureProducts } from "./fixture-store";
import type { ProductView } from "./view-model";
import { sourceStateFor, type SourceKey } from "@/features/sources/status";

const USER_ID = "local-owner";

export async function listProducts(): Promise<ProductView[]> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return listFixtureProducts();
  if (!env.DATABASE_URL) return [];
  const { db, client } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    const rows = await db.select({ product: products, state: userProductStates.state, listing: retailerListings, retailerKey: retailers.key, retailerName: retailers.name }).from(products)
      .leftJoin(userProductStates, and(eq(userProductStates.productId, products.id), eq(userProductStates.userId, USER_ID)))
      .innerJoin(retailerListings, eq(retailerListings.productId, products.id)).innerJoin(retailers, eq(retailers.id, retailerListings.retailerId)).orderBy(desc(products.firstDetectedAt));
    const productIds = rows.map((row) => row.product.id);
    const listingIds = rows.map((row) => row.listing.id);
    const [ids, observations] = await Promise.all([
      productIds.length ? db.select().from(productIdentifiers).where(inArray(productIdentifiers.productId, productIds)) : Promise.resolve([]),
      listingIds.length ? db.select({ observation: availabilityObservations, storeName: stores.name }).from(availabilityObservations).leftJoin(stores, eq(stores.id, availabilityObservations.storeId)).where(inArray(availabilityObservations.listingId, listingIds)).orderBy(desc(availabilityObservations.observedAt)) : Promise.resolve([])
    ]);
    const identifiersByProduct = groupBy(ids, (identifier) => identifier.productId);
    const observationsByListing = groupBy(observations, (item) => item.observation.listingId);
    const productRows = [...new Map(rows.map((row) => [row.product.id, row])).values()];
    return productRows.map((productRow) => ({
      id: productRow.product.id, name: productRow.product.canonicalName, brand: productRow.product.brand ?? "Unknown brand", line: productRow.product.line ?? "Unknown line", productType: productRow.product.productType ?? "Collectible", imageUrl: productRow.product.primaryImageUrl, firstDetectedAt: productRow.product.firstDetectedAt.toISOString(), state: productRow.state ?? "NEW",
      identifiers: (identifiersByProduct.get(productRow.product.id) ?? []).map((id) => ({ kind: id.kind, value: id.valueDisplay })),
      listings: rows.filter((row) => row.product.id === productRow.product.id).map((row) => ({
        id: row.listing.id,
        retailerKey: row.retailerKey,
        retailer: row.retailerName,
        url: row.listing.canonicalUrl,
        priceMinor: row.listing.priceMinor,
        status: row.listing.listingStatus,
        sourceState: sourceStateFor(env, row.retailerKey as SourceKey),
        availability: (observationsByListing.get(row.listing.id) ?? []).map((item) => ({ status: item.observation.status, observedAt: item.observation.observedAt.toISOString(), storeName: item.storeName ?? `${row.retailerName} online`, sourceAvailable: item.observation.status !== "SOURCE_UNAVAILABLE" }))
      })),
      matchingSummary: productRow.product.normalizationStatus === "NEEDS_REVIEW" ? "Matching review required" : "Identifier-backed canonical product"
    }));
  } finally { await client.end(); }
}

export async function getProduct(id: string): Promise<ProductView | null> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return getFixtureProduct(id);
  return (await listProducts()).find((product) => product.id === id) ?? null;
}

function groupBy<T>(items: readonly T[], keyFor: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFor(item);
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }
  return grouped;
}
