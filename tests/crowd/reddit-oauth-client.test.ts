import { describe, expect, it, vi } from "vitest";
import { RedditOAuthClient } from "@/adapters/crowd/reddit/oauth-client";

const context = { signal: new AbortController().signal, requestId: "oauth-test", now: new Date("2026-07-18T18:00:00.000Z") };

describe("Reddit OAuth approved-access client", () => {
  it("uses the OAuth host, bounded page size, authorization, and user agent", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ kind: "Listing", data: { after: null, children: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new RedditOAuthClient({ accessToken: "synthetic-token", userAgent: "shelf-radar-tests", fetchImpl, minRequestIntervalMs: 0 });
    expect(await client.fetchPage({ communities: ["TMNT", "RossFinds"], terms: ["TMNT"], limit: 500 }, context)).toMatchObject({ kind: "success" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("oauth.reddit.com/r/TMNT+RossFinds/new.json");
    expect(String(url)).toContain("limit=100");
    expect(init?.headers).toMatchObject({ authorization: "Bearer synthetic-token", "user-agent": "shelf-radar-tests" });
  });

  it("surfaces throttling guidance and response-size failures without retrying", async () => {
    const throttledFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "60" } }));
    const throttled = await new RedditOAuthClient({ accessToken: "synthetic", userAgent: "test", fetchImpl: throttledFetch, minRequestIntervalMs: 0 }).fetchPage({ communities: ["TMNT"], terms: ["TMNT"], limit: 10 }, context);
    expect(throttled).toMatchObject({ kind: "throttled" });
    expect(throttledFetch).toHaveBeenCalledTimes(1);

    const oversizedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("x".repeat(2_000), { status: 200 }));
    expect(await new RedditOAuthClient({ accessToken: "synthetic", userAgent: "test", fetchImpl: oversizedFetch, minRequestIntervalMs: 0, maxResponseBytes: 1_024 }).fetchPage({ communities: ["TMNT"], terms: ["TMNT"], limit: 10 }, context)).toMatchObject({ kind: "unavailable", reason: expect.stringMatching(/size limit/) });
  });

  it("times out an approved-access request without a live network call", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      }));
      const pending = new RedditOAuthClient({ accessToken: "synthetic", userAgent: "test", fetchImpl, minRequestIntervalMs: 0, requestTimeoutMs: 100 }).fetchPage({ communities: ["TMNT"], terms: ["TMNT"], limit: 10 }, context);
      await vi.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toEqual({ kind: "unavailable", reason: "Reddit approved-access request timed out" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
