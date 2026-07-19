import { describe, expect, it } from "vitest";
import { summarizeSourceRuns } from "@/features/sources/queries";

const base = {
  id: "00000000-0000-0000-0000-000000000001", sourceKey: "target", jobType: "discovery", parserVersion: "fixture-v1", runKey: "run:1",
  startedAt: new Date("2026-07-18T20:00:00.000Z"), finishedAt: new Date("2026-07-18T20:01:00.000Z"), status: "FAILED" as const,
  fetchedCount: 0, parsedCount: 0, createdCount: 0, updatedCount: 0, ignoredCount: 0, failedCount: 1,
  cursor: null, errorCode: "SOURCE_UNAVAILABLE", sanitizedMessage: "Source unavailable", createdAt: new Date("2026-07-18T20:00:00.000Z")
};

describe("source run status projection", () => {
  it("keeps the latest failure and the separate last-success timestamp", () => {
    const summary = summarizeSourceRuns([base, { ...base, id: "00000000-0000-0000-0000-000000000002", runKey: "run:0", status: "SUCCEEDED", startedAt: new Date("2026-07-18T18:00:00.000Z"), finishedAt: new Date("2026-07-18T18:01:00.000Z"), failedCount: 0, fetchedCount: 3, createdCount: 3 }]);
    expect(summary).toEqual([expect.objectContaining({ sourceKey: "target", status: "FAILED", lastSucceededAt: "2026-07-18T18:01:00.000Z", counts: expect.objectContaining({ failed: 1 }) })]);
  });
});
