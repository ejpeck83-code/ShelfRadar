import { describe, expect, it, vi } from "vitest";
import { formatFreshness } from "@/features/presentation/format";

describe("presentation clock", () => {
  it("uses the real clock by default and accepts a deterministic release clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    expect(formatFreshness("2026-07-19T10:00:00.000Z")).toBe("2 hours ago");
    expect(formatFreshness("2026-07-18T20:00:00.000Z", new Date("2026-07-18T21:00:00.000Z"))).toBe("1 hour ago");
    vi.useRealTimers();
  });
});
