import type { AdapterContext } from "@/domain/adapters";
import type { RedditApprovedAccessClient, RedditPageResponse } from ".";

type OAuthClientOptions = {
  accessToken: string;
  userAgent: string;
  requestTimeoutMs?: number;
  minRequestIntervalMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
};

export class RedditOAuthClient implements RedditApprovedAccessClient {
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly minRequestIntervalMs: number;
  private readonly maxResponseBytes: number;
  private lastRequestAt = 0;

  constructor(private readonly options: OAuthClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = Math.max(100, Math.min(60_000, options.requestTimeoutMs ?? 15_000));
    this.minRequestIntervalMs = Math.max(0, Math.min(60_000, options.minRequestIntervalMs ?? 1_000));
    this.maxResponseBytes = Math.max(1_024, Math.min(5_000_000, options.maxResponseBytes ?? 1_000_000));
  }

  async fetchPage(input: { communities: readonly string[]; terms: readonly string[]; after?: string; limit: number }, context: AdapterContext): Promise<RedditPageResponse> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minRequestIntervalMs) await delay(this.minRequestIntervalMs - elapsed, context.signal);
    if (context.signal.aborted) return { kind: "unavailable", reason: "Reddit request aborted" };

    const url = new URL(`https://oauth.reddit.com/r/${input.communities.map(encodeURIComponent).join("+")}/new.json`);
    url.searchParams.set("limit", String(Math.max(1, Math.min(100, input.limit))));
    url.searchParams.set("raw_json", "1");
    if (input.after) url.searchParams.set("after", input.after);
    const controller = new AbortController();
    const abort = () => controller.abort();
    context.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    this.lastRequestAt = Date.now();
    try {
      const response = await this.fetchImpl(url, {
        headers: { authorization: `Bearer ${this.options.accessToken}`, "user-agent": this.options.userAgent, accept: "application/json" },
        signal: controller.signal,
        redirect: "error"
      });
      if (response.status === 429) {
        const retryAt = retryAfter(response);
        return { kind: "throttled", ...(retryAt ? { retryAfter: retryAt } : {}) };
      }
      if (!response.ok) return { kind: "unavailable", reason: `Reddit approved-access request failed with status ${response.status}` };
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > this.maxResponseBytes) return { kind: "unavailable", reason: "Reddit response exceeded the configured size limit" };
      const text = await readBoundedText(response, this.maxResponseBytes);
      if (text === undefined) return { kind: "unavailable", reason: "Reddit response exceeded the configured size limit" };
      try {
        return { kind: "success", payload: JSON.parse(text) as unknown };
      } catch {
        return { kind: "unavailable", reason: "Reddit approved-access response was not valid JSON" };
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return { kind: "unavailable", reason: context.signal.aborted ? "Reddit request aborted" : "Reddit approved-access request timed out" };
      return { kind: "unavailable", reason: "Reddit approved-access request failed" };
    } finally {
      clearTimeout(timer);
      context.signal.removeEventListener("abort", abort);
    }
  }
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string | undefined> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function retryAfter(response: Response): string | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? new Date(Date.now() + seconds * 1_000).toISOString() : value;
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}
