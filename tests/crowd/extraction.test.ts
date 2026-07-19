import { describe, expect, it } from "vitest";
import fixturePage from "../fixtures/crowd/reddit/posts.json";
import { parseRedditPage } from "@/adapters/crowd/reddit";
import { DEFAULT_CROWD_TERMS, buildCrowdTermConfig, extractSighting } from "@/features/sightings/parser";
import { matchSightingCandidates } from "@/features/sightings/parser/match-candidates";

const now = new Date("2026-07-18T18:00:00.000Z");
const parsed = parseRedditPage(fixturePage, now);
if (parsed.kind !== "success") throw new Error("Fixture must parse");
const post = (id: string) => {
  const found = parsed.items.find((item) => item.externalPostId === id);
  if (!found) throw new Error(`Missing fixture ${id}`);
  return found;
};

describe("structured crowd sighting extraction", () => {
  it("makes named local exact-photo Ross evidence strongest without claiming inventory", () => {
    const result = extractSighting(post("ross_local_1"), DEFAULT_CROWD_TERMS, now);
    expect(result).toMatchObject({
      retailerKey: "ross",
      locationScope: "NAMED_STORE",
      city: "Fishers",
      mediaEvidence: "PHOTO_LINK",
      evidenceKind: "EXACT_PRODUCT_PHOTO",
      reviewStatus: "AUTO_ACCEPTED"
    });
    expect(result.identifierMentions).toContainEqual({ kind: "UPC", value: "634482541333" });
    expect(result.confidenceReasons).toEqual(expect.arrayContaining(["ROSS_NAMED_LOCAL_STORE", "EXACT_IDENTIFIER", "PHOTO_LINK_PRESENT"]));
    expect(result).not.toHaveProperty("availabilityStatus");
  });

  it("keeps regional, national, unknown, and stale Ross evidence distinct", () => {
    expect(extractSighting(post("ross_regional_1"), DEFAULT_CROWD_TERMS, now)).toMatchObject({ locationScope: "REGIONAL", city: "Louisville" });
    const national = extractSighting(post("ross_national_1"), DEFAULT_CROWD_TERMS, now);
    expect(national).toMatchObject({ locationScope: "NATIONAL", evidenceKind: "LINE_OR_WAVE_TEXT" });
    expect(national.confidenceReasons).toContain("NATIONAL_SIGNAL_NOT_LOCAL");
    expect(extractSighting(post("ross_unknown_1"), DEFAULT_CROWD_TERMS, now)).toMatchObject({ locationScope: "UNKNOWN", reviewStatus: "NEEDS_REVIEW" });
    expect(extractSighting(post("stale_ross_1"), DEFAULT_CROWD_TERMS, now).confidenceReasons).toContain("STALE_EVIDENCE");
  });

  it("uses bounded configurable aliases and regional locations", () => {
    const terms = buildCrowdTermConfig({
      tmntTerms: ["TMNT"],
      productAliases: ["Ronin Raphael"],
      lineBrandAliases: ["NECA"],
      retailerAliases: { ross: ["Ross Dress for Less"] },
      localLocations: [{ term: "Broad Ripple", city: "Indianapolis", region: "IN" }],
      regionalLocations: [{ term: "Columbus", city: "Columbus", region: "OH" }]
    });
    expect(terms.productAliases).toContain("ronin raphael");
    expect(() => buildCrowdTermConfig({ tmntTerms: Array.from({ length: 101 }, (_, index) => `term-${index}`) })).toThrow(/bounded/i);
  });

  it("routes identifier conflicts and alias-only candidates to deterministic review", () => {
    const extraction = extractSighting(post("identifier_conflict_1"), DEFAULT_CROWD_TERMS, now);
    const result = matchSightingCandidates(extraction, [
      { productId: "one", canonicalName: "Last Ronin Raphael", aliases: ["Ronin Raphael"], identifiers: [{ kind: "UPC", valueNormalized: "634482541333" }] },
      { productId: "two", canonicalName: "TMNT Target Figure", aliases: [], identifiers: [{ kind: "TCIN", valueNormalized: "91234567", retailerKey: "target" }] }
    ]);
    expect(result.reviewRequired).toBe(true);
    expect(result.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: "one", confirmed: false, reasonCodes: expect.arrayContaining(["CONFLICTING_EXACT_IDENTIFIERS"]) }),
      expect.objectContaining({ productId: "two", confirmed: false, reasonCodes: expect.arrayContaining(["CONFLICTING_EXACT_IDENTIFIERS"]) })
    ]));

    const aliasOnly = matchSightingCandidates(extractSighting(post("ross_regional_1"), DEFAULT_CROWD_TERMS, now), [
      { productId: "one", canonicalName: "Last Ronin Raphael", aliases: ["Last Ronin Raphael"], identifiers: [] }
    ]);
    expect(aliasOnly.candidates[0]).toMatchObject({ productId: "one", matchType: "exact_alias", confirmed: false });
  });

  it("does not promote an invalid labeled identifier to exact-product evidence", () => {
    const invalid = extractSighting({ ...post("ross_local_1"), title: "TMNT at Ross in Fishers", bodyExcerpt: "UPC 12345678 today" }, DEFAULT_CROWD_TERMS, now);
    expect(invalid.identifierMentions).toEqual([]);
    expect(invalid.evidenceKind).toBe("GENERAL_RETAILER_ACTIVITY");
    expect(invalid.confidenceReasons).not.toContain("EXACT_IDENTIFIER");
  });
});
