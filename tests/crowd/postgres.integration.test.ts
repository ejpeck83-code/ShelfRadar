import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import fixturePage from "../fixtures/crowd/reddit/posts.json";
import { parseRedditPage } from "@/adapters/crowd/reddit";
import { createDatabase } from "@/db/client";
import { availabilityObservations, crowdPosts, productIdentifiers, products, retailers, sightingProductCandidates, sightings } from "@/db/schema";
import { DEFAULT_CROWD_TERMS } from "@/features/sightings/parser";
import { PostgresCrowdSightingRepository, ingestCrowdPosts } from "@/features/sightings/parser/persistence";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL crowd sighting integration", () => {
  const database = createDatabase(url ?? "postgresql://invalid", { max: 2 });
  const now = new Date("2026-07-18T18:00:00.000Z");

  beforeAll(async () => {
    await database.db.execute(sql`truncate table products, retailers restart identity cascade`);
    await database.db.insert(retailers).values([
      { key: "ross", name: "Ross Dress for Less", kind: "CROWD_INVENTORY" },
      { key: "target", name: "Target", kind: "PHYSICAL_AND_ONLINE" },
      { key: "neca", name: "NECA Store", kind: "ONLINE_ONLY" }
    ]);
    const inserted = await database.db.insert(products).values([
      { canonicalName: "NECA Last Ronin Raphael", franchise: "TMNT", brand: "NECA", line: "Last Ronin", characters: ["Raphael"], firstDetectedAt: now, lastSeenAt: now },
      { canonicalName: "TMNT Target Figure", franchise: "TMNT", firstDetectedAt: now, lastSeenAt: now }
    ]).returning({ id: products.id, name: products.canonicalName });
    const one = inserted.find((item) => item.name.includes("Raphael"))!;
    const two = inserted.find((item) => item.name.includes("Target"))!;
    await database.db.insert(productIdentifiers).values([
      { productId: one.id, kind: "UPC", namespace: "global:UPC", valueNormalized: "634482541333", valueDisplay: "634482541333", confidence: "EXACT", firstObservedAt: now, lastObservedAt: now },
      { productId: two.id, kind: "TCIN", namespace: "target:TCIN", valueNormalized: "91234567", valueDisplay: "91234567", confidence: "EXACT", firstObservedAt: now, lastObservedAt: now }
    ]);
  });

  afterAll(async () => database.client.end());

  it("persists posts, one sighting per evidence group, candidates, and idempotent replay without availability rows", async () => {
    const parsed = parseRedditPage(fixturePage, now);
    if (parsed.kind !== "success") throw new Error("Fixture must parse");
    const repository = new PostgresCrowdSightingRepository(database.db);
    await ingestCrowdPosts({ posts: parsed.items, repository, terms: DEFAULT_CROWD_TERMS, now });
    await ingestCrowdPosts({ posts: parsed.items, repository, terms: DEFAULT_CROWD_TERMS, now });

    expect(await database.db.select().from(crowdPosts)).toHaveLength(9);
    expect(await database.db.select().from(sightings)).toHaveLength(8);
    expect((await database.db.select().from(sightingProductCandidates)).length).toBeGreaterThan(0);
    expect(await database.db.select().from(availabilityObservations)).toHaveLength(0);
    const ross = (await database.db.select().from(retailers).where(eq(retailers.key, "ross")))[0]!;
    expect((await database.db.select().from(sightings).where(eq(sightings.retailerId, ross.id))).some((sighting) => sighting.locationScope === "NATIONAL")).toBe(true);
  });
});
