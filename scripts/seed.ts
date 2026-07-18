import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDatabase } from "../src/db/client";
import { appUsers, retailers, stores } from "../src/db/schema";

const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required to seed");
const { db, client } = createDatabase(url, { max: 1 });

const retailerSeeds = [
  { key: "target", name: "Target", kind: "PHYSICAL_AND_ONLINE" as const },
  { key: "walmart", name: "Walmart", kind: "PHYSICAL_AND_ONLINE" as const },
  { key: "meijer", name: "Meijer", kind: "PHYSICAL_AND_ONLINE" as const },
  { key: "neca", name: "NECA Store", kind: "ONLINE_ONLY" as const },
  { key: "online", name: "Selected online retailers", kind: "ONLINE_ONLY" as const },
  { key: "ross", name: "Ross Dress for Less", kind: "CROWD_INVENTORY" as const }
];

try {
  await db.insert(appUsers).values({ id: "local-owner", displayName: "Local collector" }).onConflictDoNothing();
  for (const retailer of retailerSeeds) await db.insert(retailers).values(retailer).onConflictDoUpdate({ target: retailers.key, set: { name: retailer.name, kind: retailer.kind, active: true, updatedAt: new Date() } });
  const target = (await db.select({ id: retailers.id }).from(retailers).where(eq(retailers.key, "target")).limit(1))[0];
  if (!target) throw new Error("Target retailer seed failed");
  const targetStores = [
    { retailerStoreId: "T-1350", name: "Target Fishers", city: "Fishers", region: "IN", postalCode: "46038" },
    { retailerStoreId: "T-1363", name: "Target Carmel", city: "Carmel", region: "IN", postalCode: "46032" },
    { retailerStoreId: "T-1788", name: "Target Westfield", city: "Westfield", region: "IN", postalCode: "46074" },
    { retailerStoreId: "T-2071", name: "Target Castleton", city: "Indianapolis", region: "IN", postalCode: "46250" },
    { retailerStoreId: "T-2261", name: "Target Noblesville", city: "Noblesville", region: "IN", postalCode: "46060" }
  ];
  for (const store of targetStores) await db.insert(stores).values({ ...store, retailerId: target.id, addressSummary: `${store.city}, ${store.region}` }).onConflictDoUpdate({ target: [stores.retailerId, stores.retailerStoreId], set: { name: store.name, city: store.city, region: store.region, postalCode: store.postalCode, active: true, updatedAt: new Date() } });
  console.log(`Seeded ${retailerSeeds.length} retailers, ${targetStores.length} central-Indiana Target stores, and the local owner.`);
} finally {
  await client.end();
}
