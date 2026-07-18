import type { AdapterContext, AdapterResult, DiscoveryQuery, RawListing } from "@/domain/adapters";

export type RetailAdapterMode = "fixture" | "unavailable" | "provider";

export type AdapterSafetyPolicy = {
  readonly maxPagesPerRequest: number;
  readonly requestTimeoutMs: number;
  readonly maxResponseBytes: number;
  readonly minRequestIntervalMs: number;
  readonly retryBackoffSeconds: readonly number[];
};

export const DEFAULT_ADAPTER_POLICY: AdapterSafetyPolicy = {
  maxPagesPerRequest: 5,
  requestTimeoutMs: 15_000,
  maxResponseBytes: 512_000,
  minRequestIntervalMs: 1_000,
  retryBackoffSeconds: [30, 120, 300]
};

export type ListingDetailQuery = { externalId: string };

export interface ApprovedRetailProvider {
  discover(query: DiscoveryQuery, context: AdapterContext): Promise<unknown>;
  fetchListing?(query: ListingDetailQuery, context: AdapterContext): Promise<unknown>;
}

export function validateDiscoveryQuery(query: DiscoveryQuery, policy: AdapterSafetyPolicy): AdapterResult<RawListing> | null {
  if (!Number.isInteger(query.pageLimit) || query.pageLimit < 1 || query.pageLimit > policy.maxPagesPerRequest) {
    return { kind: "malformed", reason: `pageLimit must be between 1 and ${policy.maxPagesPerRequest}` };
  }
  if (query.terms.length > 20 || query.terms.some((term) => term.length > 120)) {
    return { kind: "malformed", reason: "discovery terms exceed configured bounds" };
  }
  if (query.cursor !== undefined && (query.cursor.length > 200 || !/^[A-Za-z0-9._~-]+$/.test(query.cursor))) {
    return { kind: "malformed", reason: "cursor is invalid" };
  }
  return null;
}

export function responseWithinLimit(payload: unknown, maxResponseBytes: number): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).byteLength <= maxResponseBytes;
  } catch {
    return false;
  }
}

export async function callProvider(
  operation: (context: AdapterContext) => Promise<unknown>,
  context: AdapterContext,
  policy: AdapterSafetyPolicy,
  sourceLabel: string
): Promise<AdapterResult<RawListing> | { kind: "payload"; payload: unknown }> {
  if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
  const controller = new AbortController();
  const abort = () => controller.abort();
  context.signal.addEventListener("abort", abort, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const providerContext = { ...context, signal: controller.signal };
    const timeoutResult = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        const error = new Error("provider timeout");
        error.name = "TimeoutError";
        reject(error);
      }, policy.requestTimeoutMs);
    });
    const payload = await Promise.race([operation(providerContext), timeoutResult]);
    if (!responseWithinLimit(payload, policy.maxResponseBytes)) {
      return { kind: "malformed", reason: `${sourceLabel} payload exceeded the response-size limit`, rawRef: "redacted:oversize-payload" };
    }
    return { kind: "payload", payload };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return { kind: "unavailable", reason: `${sourceLabel} approved provider timed out` };
    }
    if (context.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
      return { kind: "unavailable", reason: "request aborted" };
    }
    return { kind: "unavailable", reason: `${sourceLabel} approved provider request failed` };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    context.signal.removeEventListener("abort", abort);
  }
}

export function unavailableReason(sourceLabel: string): string {
  return `${sourceLabel} approved provider is not configured; cached data remains visible`;
}
