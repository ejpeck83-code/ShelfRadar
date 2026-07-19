import { describe, expect, it } from "vitest";
import { rawCrowdPostSchema, rawListingSchema } from "@/domain/adapters";

const listing = {
  externalId: "safe-1",
  title: "TMNT figure",
  canonicalUrl: "https://example.com/tmnt",
  identifiers: [],
  provenance: {
    sourceKey: "fixture",
    externalId: "safe-1",
    fetchedAt: "2026-07-18T16:00:00.000Z",
    parserVersion: "fixture-v1",
    rawRef: "redacted:fixture"
  }
};

describe("canonical adapter URLs", () => {
  it("accepts only public HTTP(S) listing and image URLs", () => {
    expect(rawListingSchema.safeParse(listing).success).toBe(true);
    expect(rawListingSchema.safeParse({ ...listing, canonicalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(rawListingSchema.safeParse({ ...listing, imageUrl: "data:text/html,<script>alert(1)</script>" }).success).toBe(false);
  });
  it("rejects executable crowd media URLs", () => {
    const crowdPost = {
      externalPostId: "post-1",
      sourceRecordKey: "t3_post-1",
      permalink: "https://www.reddit.com/r/TMNT/comments/post-1",
      community: "TMNT",
      title: "TMNT sighting",
      postedAt: "2026-07-18T16:00:00.000Z",
      fetchedAt: "2026-07-18T16:05:00.000Z",
      mediaEvidence: "UNKNOWN",
      contentHash: "a".repeat(64),
      provenance: {
        sourceKey: "reddit",
        externalId: "post-1",
        fetchedAt: "2026-07-18T16:05:00.000Z",
        parserVersion: "reddit-v1",
        rawRef: `sha256:${"b".repeat(64)}`
      }
    };
    expect(rawCrowdPostSchema.safeParse(crowdPost).success).toBe(true);
    expect(rawCrowdPostSchema.safeParse({ ...crowdPost, mediaUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});
