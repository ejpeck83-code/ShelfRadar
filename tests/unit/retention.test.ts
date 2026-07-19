import { describe, expect, it } from "vitest";
import { retentionCutoff } from "@/operations/retention";

describe("raw-source retention", () => {
  it("uses a deterministic UTC cutoff", () => {
    expect(retentionCutoff(new Date("2026-07-18T18:00:00.000Z"), 30).toISOString()).toBe("2026-06-18T18:00:00.000Z");
  });
});
