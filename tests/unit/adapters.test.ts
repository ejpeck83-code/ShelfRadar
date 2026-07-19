import { describe, expect, it } from "vitest";
import { rawListingSchema } from "@/domain/adapters";

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
});
