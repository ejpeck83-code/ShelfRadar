export type BoundedFetchResult =
  | { kind: "success"; text: string; headers: Headers }
  | { kind: "unavailable"; reason: string }
  | { kind: "throttled"; retryAfter?: string };

type BoundedFetchOptions = {
  allowedHostname: string;
  sourceLabel: string;
  signal: AbortSignal;
  now: Date;
  headers?: HeadersInit;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
};

export async function fetchBoundedText(url: URL, options: BoundedFetchOptions): Promise<BoundedFetchResult> {
  if (url.protocol !== "https:" || url.hostname !== options.allowedHostname || url.username || url.password) {
    return { kind: "unavailable", reason: `${options.sourceLabel} request target was rejected` };
  }
  if (options.signal.aborted) return { kind: "unavailable", reason: `${options.sourceLabel} request aborted` };

  const requestTimeoutMs = Math.max(100, Math.min(60_000, options.requestTimeoutMs ?? 15_000));
  const maxResponseBytes = Math.max(1_024, Math.min(5_000_000, options.maxResponseBytes ?? 1_000_000));
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: "GET",
      ...(options.headers ? { headers: options.headers } : {}),
      redirect: "error",
      signal: controller.signal
    });
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get("retry-after"), options.now);
      return { kind: "throttled", ...(retryAfter ? { retryAfter } : {}) };
    }
    if (!response.ok) return { kind: "unavailable", reason: `${options.sourceLabel} request failed with status ${response.status}` };
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > maxResponseBytes) return { kind: "unavailable", reason: `${options.sourceLabel} response exceeded the configured size limit` };
    const text = await readBoundedText(response, maxResponseBytes);
    return text === undefined
      ? { kind: "unavailable", reason: `${options.sourceLabel} response exceeded the configured size limit` }
      : { kind: "success", text, headers: response.headers };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "unavailable", reason: options.signal.aborted ? `${options.sourceLabel} request aborted` : `${options.sourceLabel} request timed out` };
    }
    return { kind: "unavailable", reason: `${options.sourceLabel} request failed` };
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", abort);
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

function parseRetryAfter(value: string | null, now: Date): string | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return new Date(now.getTime() + Math.max(0, seconds) * 1_000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
