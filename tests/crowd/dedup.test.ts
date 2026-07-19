import { describe, expect, it } from "vitest";
import fixturePage from "../fixtures/crowd/reddit/posts.json";
import { parseRedditPage } from "@/adapters/crowd/reddit";
import { buildEvidenceGroups, fingerprintCrowdPost, isNearDuplicate } from "@/features/sightings/dedup";
import { crowdSightingIdempotencyKey } from "@/features/sightings/parser/persistence";

const parsed = parseRedditPage(fixturePage, new Date("2026-07-18T18:00:00.000Z"));
if (parsed.kind !== "success") throw new Error("Fixture must parse");

describe("crowd provenance-preserving deduplication", () => {
  it("groups cross-posts without dropping either permalink", () => {
    const groups = buildEvidenceGroups(parsed.items);
    const original = groups.find((entry) => entry.post.externalPostId === "ross_local_1");
    const crosspost = groups.find((entry) => entry.post.externalPostId === "ross_crosspost_1");
    expect(original?.evidenceGroupKey).toBe(crosspost?.evidenceGroupKey);
    expect(crowdSightingIdempotencyKey(original!.evidenceGroupKey)).toBe(crowdSightingIdempotencyKey(crosspost!.evidenceGroupKey));
    expect(crosspost?.duplicateReason).toBe("CROSSPOST_PARENT");
    expect(new Set([original?.post.permalink, crosspost?.post.permalink]).size).toBe(2);
  });

  it("detects normalized reposts while keeping materially different reports independent", () => {
    const original = parsed.items.find((post) => post.externalPostId === "ross_local_1")!;
    const nearCopy = { ...original, externalPostId: "near-copy", title: `${original.title}!!!`, bodyExcerpt: `${original.bodyExcerpt ?? ""} posted again` };
    const regional = parsed.items.find((post) => post.externalPostId === "ross_regional_1")!;
    expect(isNearDuplicate(original, nearCopy)).toBe(true);
    expect(isNearDuplicate(original, regional)).toBe(false);
    expect(fingerprintCrowdPost(original).contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
