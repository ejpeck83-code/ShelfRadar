import fixturePage from "../../../tests/fixtures/crowd/reddit/posts.json";
import { and, desc, eq } from "drizzle-orm";
import { RedditCrowdAdapter } from "@/adapters/crowd/reddit";
import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { crowdPosts, retailers, sightingProductCandidates, sightings } from "@/db/schema";
import { buildRedditQueryTerms, DEFAULT_CROWD_TERMS, extractSighting } from "@/features/sightings/parser";
import { buildEvidenceGroups } from "@/features/sightings/dedup";
import { sourceStateFor } from "@/features/sources/status";

export type SignalView = {
  id: string;
  kind: "crowd_sighting";
  title: string;
  excerpt?: string;
  permalink: string;
  postedAt: string;
  retailerKey?: string;
  retailer: string;
  locationScope: "NAMED_STORE" | "LOCAL_CITY" | "REGIONAL" | "NATIONAL" | "UNKNOWN";
  locationLabel: string;
  evidenceLabel: string;
  reviewRequired: boolean;
};

type SignalQuery = { dataMode?: "fixture" | "database"; retailer?: string; scope?: string; productId?: string };

export async function listSignals(query: SignalQuery = {}): Promise<{ signals: SignalView[]; sourceState: "fixture" | "available" | "cached" | "unavailable" }> {
  const env = parseEnv();
  const mode = query.dataMode ?? env.SHELF_RADAR_DATA_MODE;
  const result = mode === "fixture" ? await fixtureSignals(query.productId) : await databaseSignals(env.DATABASE_URL, query.productId, sourceStateFor(env, "reddit") === "unavailable");
  const signals = result.signals.filter((signal) => {
    const retailerMatch = !query.retailer || signal.retailerKey === query.retailer;
    const scopeMatch = !query.scope || (query.scope === "LOCAL" ? ["NAMED_STORE", "LOCAL_CITY"].includes(signal.locationScope) : signal.locationScope === query.scope);
    return retailerMatch && scopeMatch;
  });
  return { ...result, signals };
}

async function fixtureSignals(productId?: string): Promise<{ signals: SignalView[]; sourceState: "fixture" }> {
  if (productId && productId !== "2d1f0d9e-06d4-4e61-b7f1-6d10442fda01") return { signals: [], sourceState: "fixture" };
  const now = new Date("2026-07-18T18:00:00.000Z");
  const adapter = new RedditCrowdAdapter({ mode: "fixture", fixturePages: [fixturePage] });
  const result = await adapter.fetchPosts({ terms: buildRedditQueryTerms(DEFAULT_CROWD_TERMS), pageLimit: 1 }, { signal: new AbortController().signal, requestId: "signals:fixture", now });
  if (result.kind !== "success") return { signals: [], sourceState: "fixture" };
  const seenEvidence = new Set<string>();
  const posts = buildEvidenceGroups(result.items).flatMap((group) => {
    if (seenEvidence.has(group.evidenceGroupKey)) return [];
    seenEvidence.add(group.evidenceGroupKey);
    return [group.post];
  });
  return {
    sourceState: "fixture",
    signals: posts.map((post) => {
      const sighting = extractSighting(post, DEFAULT_CROWD_TERMS, now);
      return {
        id: post.externalPostId,
        kind: "crowd_sighting" as const,
        title: post.title,
        ...(post.bodyExcerpt ? { excerpt: post.bodyExcerpt } : {}),
        permalink: post.permalink,
        postedAt: post.postedAt,
        ...(sighting.retailerKey ? { retailerKey: sighting.retailerKey } : {}),
        retailer: sighting.retailerKey ? sourceName(sighting.retailerKey) : "Retailer unclear",
        locationScope: sighting.locationScope,
        locationLabel: locationLabel(sighting.locationScope, sighting.locationText),
        evidenceLabel: sighting.evidenceKind.toLowerCase().replaceAll("_", " "),
        reviewRequired: sighting.reviewStatus !== "AUTO_ACCEPTED"
      };
    }).sort((left, right) => right.postedAt.localeCompare(left.postedAt))
  };
}

async function databaseSignals(databaseUrl: string | undefined, productId: string | undefined, sourceUnavailable: boolean): Promise<{ signals: SignalView[]; sourceState: "available" | "cached" | "unavailable" }> {
  if (!databaseUrl) return { signals: [], sourceState: "unavailable" };
  const { db, client } = createDatabase(databaseUrl, { max: 1 });
  try {
    const rows = await db.selectDistinct({ post: crowdPosts, sighting: sightings, retailerKey: retailers.key, retailerName: retailers.name }).from(sightings)
      .innerJoin(crowdPosts, eq(crowdPosts.id, sightings.crowdPostId))
      .leftJoin(retailers, eq(retailers.id, sightings.retailerId))
      .leftJoin(sightingProductCandidates, eq(sightingProductCandidates.sightingId, sightings.id))
      .where(and(eq(crowdPosts.sourceKey, "reddit"), productId ? eq(sightingProductCandidates.productId, productId) : undefined))
      .orderBy(desc(crowdPosts.postedAt));
    return { sourceState: sourceUnavailable ? "cached" : "available", signals: rows.map((row) => ({ id: row.post.externalPostId, kind: "crowd_sighting", title: row.post.title, ...(row.post.bodyExcerpt ? { excerpt: row.post.bodyExcerpt } : {}), permalink: row.post.permalink, postedAt: row.post.postedAt.toISOString(), ...(row.retailerKey ? { retailerKey: row.retailerKey } : {}), retailer: row.retailerName ?? "Retailer unclear", locationScope: row.sighting.locationScope, locationLabel: locationLabel(row.sighting.locationScope, row.sighting.locationText ?? undefined), evidenceLabel: row.sighting.evidenceKind.toLowerCase().replaceAll("_", " "), reviewRequired: row.sighting.reviewStatus !== "AUTO_ACCEPTED" })) };
  } finally {
    await client.end();
  }
}

function locationLabel(scope: SignalView["locationScope"], text?: string): string {
  const scopeLabel = ({ NAMED_STORE: "Named-store report", LOCAL_CITY: "Local area", REGIONAL: "Regional", NATIONAL: "National", UNKNOWN: "Unknown location" } as const)[scope];
  return text ? `${scopeLabel} · ${text}` : scopeLabel;
}

function sourceName(key: string): string {
  return ({ ross: "Ross", target: "Target", walmart: "Walmart", meijer: "Meijer", neca: "NECA" } as Record<string, string>)[key] ?? key;
}
