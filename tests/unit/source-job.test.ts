import { describe, expect, it } from "vitest";
import { scheduledRunKey } from "@/operations/run-source-job";

describe("source job scheduling", () => {
  it("uses a deterministic per-source minute key so retries are idempotent", () => {
    const first = scheduledRunKey("target", new Date("2026-07-19T12:34:01.000Z"));
    const retry = scheduledRunKey("target", new Date("2026-07-19T12:34:59.999Z"));
    expect(first).toBe("scheduled:target:2026-07-19T12:34");
    expect(retry).toBe(first);
    expect(scheduledRunKey("walmart", new Date("2026-07-19T12:34:01.000Z"))).not.toBe(first);
  });
});
