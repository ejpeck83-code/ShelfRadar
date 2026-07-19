import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { TargetAdapter } from "@/adapters/retail/target";
import { createDatabase } from "@/db/client";
import { PostgresCatalogRepository } from "@/db/repositories/postgres-catalog";
import { productStateHistory, products, retailers, stores, userProductStates } from "@/db/schema";
import { runDiscovery } from "@/ingestion/run-discovery";
import { classifyProduct } from "@/features/catalog/classify";
import { listProducts } from "@/features/catalog/queries";
import { withPostgresLease } from "@/operations/postgres-lease";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL catalog integration", () => {
  const database = createDatabase(url ?? "postgresql://invalid", { max: 2 });
  beforeAll(async () => {
    await database.db.execute(sql`truncate table products, retailers, app_users, ingestion_runs restart identity cascade`);
    const target = (await database.db.insert(retailers).values({ key: "target", name: "Target", kind: "PHYSICAL_AND_ONLINE" }).returning({ id: retailers.id }))[0];
    if (!target) throw new Error("Target seed failed");
    await database.db.insert(stores).values([{ retailerId: target.id, retailerStoreId: "T-1350", name: "Target Fishers", city: "Fishers", region: "IN" }, { retailerId: target.id, retailerStoreId: "T-1363", name: "Target Carmel", city: "Carmel", region: "IN" }, { retailerId: target.id, retailerStoreId: "T-1788", name: "Target Westfield", city: "Westfield", region: "IN" }]);
  });
  afterAll(async () => database.client.end());
  it("ingests and replays idempotently against PostgreSQL", async () => {
    const repository = new PostgresCatalogRepository(database.db); const adapter = new TargetAdapter("fixture"); const now = new Date("2026-07-18T16:00:00.000Z");
    await runDiscovery({ adapter, repository, now, runKey: "pg:first", terms: ["TMNT"] });
    await runDiscovery({ adapter, repository, now, runKey: "pg:replay", terms: ["TMNT"] });
    expect(await database.db.select().from(products)).toHaveLength(3);
  });
  it("rolls back partial transactions", async () => {
    const repository = new PostgresCatalogRepository(database.db);
    const fixture = await new TargetAdapter("fixture").discover({ terms: ["TMNT"], pageLimit: 1 }, { signal: new AbortController().signal, requestId: "rollback", now: new Date("2026-07-18T16:00:00.000Z") });
    const item = fixture.kind === "success" ? fixture.items[0] : undefined;
    if (!item) throw new Error("Target fixture missing");
    await expect(repository.inTransaction(async (transactional) => { await transactional.createProductFromListing({ ...item, title: "Rollback figure" }); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect((await database.db.select().from(products)).some((product) => product.canonicalName === "Rollback figure")).toBe(false);
  });

  it("prevents overlapping jobs with a database advisory lease", async () => {
    if (!url) throw new Error("Database URL missing");
    const outer = await withPostgresLease(url, "test:exclusive-job", async () => withPostgresLease(url, "test:exclusive-job", async () => "unexpected"));
    expect(outer).toEqual({ acquired: true, value: { acquired: false } });
  });

  it("keeps cached catalog rows readable with timestamps when every source is unavailable", async () => {
    if (!url) throw new Error("Database URL missing");
    const keys = ["SHELF_RADAR_DATA_MODE", "DATABASE_URL", "TARGET_ADAPTER_MODE", "WALMART_ADAPTER_MODE", "MEIJER_ADAPTER_MODE", "NECA_ADAPTER_MODE", "ONLINE_RETAIL_ADAPTER_MODE", "REDDIT_ADAPTER_MODE"] as const;
    const prior = new Map(keys.map((key) => [key, process.env[key]]));
    process.env.SHELF_RADAR_DATA_MODE = "database";
    process.env.DATABASE_URL = url;
    process.env.TARGET_ADAPTER_MODE = "unavailable";
    process.env.WALMART_ADAPTER_MODE = "unavailable";
    process.env.MEIJER_ADAPTER_MODE = "unavailable";
    process.env.NECA_ADAPTER_MODE = "unavailable";
    process.env.ONLINE_RETAIL_ADAPTER_MODE = "unavailable";
    process.env.REDDIT_ADAPTER_MODE = "unavailable";
    try {
      const cached = await listProducts();
      expect(cached.length).toBeGreaterThan(0);
      expect(cached.every((product) => product.firstDetectedAt.endsWith("Z"))).toBe(true);
      expect(cached.flatMap((product) => product.listings).every((listing) => listing.sourceState === "unavailable")).toBe(true);
      expect(cached.flatMap((product) => product.listings).flatMap((listing) => listing.availability).every((observation) => observation.observedAt.endsWith("Z"))).toBe(true);
    } finally {
      for (const key of keys) {
        const value = prior.get(key);
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
  it("treats a repeated classification mutation ID as a no-op", async () => {
    const product = (await database.db.select({ id: products.id }).from(products).limit(1))[0];
    if (!product || !url) throw new Error("Fixture product missing");
    const previousMode = process.env.SHELF_RADAR_DATA_MODE;
    const previousUrl = process.env.DATABASE_URL;
    process.env.SHELF_RADAR_DATA_MODE = "database";
    process.env.DATABASE_URL = url;
    try {
      const firstMutationId = "3c7289b8-657e-4c8c-92be-acde4c22d083";
      await classifyProduct(product.id, "HUNT", firstMutationId);
      await classifyProduct(product.id, "OWN", "4b839ac9-768f-4d9d-a3cf-bdef5d33e194");
      await classifyProduct(product.id, "WATCH", firstMutationId);
      expect(await database.db.select({ state: userProductStates.state }).from(userProductStates)).toContainEqual({ state: "OWN" });
      expect(await database.db.select().from(productStateHistory)).toHaveLength(2);
    } finally {
      if (previousMode === undefined) delete process.env.SHELF_RADAR_DATA_MODE; else process.env.SHELF_RADAR_DATA_MODE = previousMode;
      if (previousUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previousUrl;
    }
  });
});
