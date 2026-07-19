import { describe, expect, it } from "vitest";
import redditFixture from "../fixtures/crowd/reddit/posts.json";
import { RedditCrowdAdapter } from "@/adapters/crowd/reddit";
import { MeijerAdapter } from "@/adapters/retail/meijer";
import { NecaAdapter } from "@/adapters/retail/neca";
import { ConfiguredOnlineRetailerAdapter } from "@/adapters/retail/online";
import { TargetAdapter } from "@/adapters/retail/target";
import { WalmartAdapter } from "@/adapters/retail/walmart";
import { rankStore } from "@/ranking/rank-store";

const now = new Date("2026-07-18T20:00:00.000Z");
const context = { signal: new AbortController().signal, requestId: "release-ranking", now };
const retailQuery = { terms: ["TMNT"], pageLimit: 1 };

describe("MVP combined-source ranking", () => {
  it("uses all fixture source families, a deterministic clock, and weaker line/wave factors", async () => {
    const results = await Promise.all([
      new TargetAdapter("fixture").discover(retailQuery, context),
      new WalmartAdapter("fixture").discover(retailQuery, context),
      new MeijerAdapter("fixture").discover(retailQuery, context),
      new NecaAdapter("fixture").discover(retailQuery, context),
      new ConfiguredOnlineRetailerAdapter({ retailer: "bigbadtoystore", mode: "fixture" }).discover(retailQuery, context),
      new RedditCrowdAdapter({ mode: "fixture", fixturePages: [redditFixture] }).fetchPosts({ terms: ["TMNT", "Last Ronin"], pageLimit: 1 }, context)
    ]);
    expect(results.every((result) => result.kind === "success")).toBe(true);

    const references = ["target", "walmart", "meijer", "neca", "online"].map((source, index) => {
      const result = results[index];
      if (!result || result.kind !== "success" || !result.items[0]) throw new Error(`${source} fixture missing`);
      return `${source}:${result.items[0].provenance.externalId}`;
    });
    const reddit = results[5];
    if (!reddit || reddit.kind !== "success") throw new Error("Reddit fixture missing");
    const ross = reddit.items.find((post) => post.community === "RossFinds");
    if (!ross) throw new Error("Ross fixture missing");

    const result = rankStore({
      productId: "fixture-product",
      storeId: "fixture-store",
      calculatedAt: now,
      storePreference: 0,
      evidence: [
        ...references.map((reference) => ({ reference, observedAt: new Date("2026-07-18T16:00:00.000Z"), recentRetailPositive: true })),
        { reference: `reddit:${ross.externalPostId}`, observedAt: new Date("2026-07-18T18:00:00.000Z"), exactText: true },
        { reference: `ross:${ross.externalPostId}`, observedAt: new Date("2026-07-18T18:00:00.000Z"), regionalRossActivity: true },
        { reference: "reddit:line-wave-fixture", observedAt: new Date("2026-07-18T18:00:00.000Z"), lineWavePhoto: true, lineWaveText: true }
      ]
    });

    expect(result.calculatedAt).toBe(now.toISOString());
    expect(new Set(result.factors.map((factor) => factor.evidenceRef)).size).toBeGreaterThanOrEqual(8);
    for (const source of ["target", "walmart", "meijer", "neca", "online", "reddit", "ross"]) {
      expect(result.factors.some((factor) => factor.evidenceRef.startsWith(`${source}:`))).toBe(true);
    }
    const exact = result.factors.find((factor) => factor.code === "EXACT_PRODUCT_TEXT");
    const linePhoto = result.factors.find((factor) => factor.code === "LINE_OR_WAVE_PHOTO");
    const lineText = result.factors.find((factor) => factor.code === "LINE_OR_WAVE_TEXT");
    expect(exact?.points).toBeGreaterThan(linePhoto?.points ?? Number.MAX_SAFE_INTEGER);
    expect(linePhoto?.points).toBeGreaterThan(lineText?.points ?? Number.MAX_SAFE_INTEGER);
    expect(result.factors.every((factor) => factor.explanation.length > 0 && factor.observedAt.endsWith("Z"))).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/percent|probability/i);
  });
});
