import fixturePayload from "../../../../tests/fixtures/retail/target/discovery.json";
import { rawListingSchema, type AdapterResult, type DiscoveryQuery, type RawListing, type RetailDiscoveryAdapter, type AdapterContext } from "@/domain/adapters";
import type { AppEnv } from "@/config/env";
import { callProvider, DEFAULT_ADAPTER_POLICY, urlMatchesAllowedHosts, validateDiscoveryQuery, type AdapterSafetyPolicy } from "../online/support";

export const TARGET_PARSER_VERSION = "target-fixture-v1";

export interface TargetProvider {
  discover(query: DiscoveryQuery, context: AdapterContext): Promise<unknown>;
}

export function parseTargetPayload(payload: unknown): AdapterResult<RawListing> {
  const parsed = rawListingSchema.array().safeParse(payload);
  if (!parsed.success) {
    return { kind: "malformed", reason: "Target payload failed canonical validation", rawRef: "redacted:validation-error" };
  }
  if (parsed.data.some((item) => !urlMatchesAllowedHosts(item.canonicalUrl, ["target.com"]))) {
    return { kind: "malformed", reason: "Target item URL is outside the configured allowlist", rawRef: "redacted:disallowed-host" };
  }
  return { kind: "success", items: parsed.data, fetchedAt: parsed.data[0]?.provenance.fetchedAt ?? new Date(0).toISOString() };
}

export class TargetAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "target";
  readonly parserVersion = TARGET_PARSER_VERSION;
  readonly capabilities = ["product_discovery", "listing_detail", "store_availability"] as const;

  constructor(private readonly mode: AppEnv["TARGET_ADAPTER_MODE"], private readonly provider?: TargetProvider, readonly policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY) {}

  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    const invalid = validateDiscoveryQuery(query, this.policy);
    if (invalid) return invalid;
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    if (this.mode === "fixture") return parseTargetPayload(fixturePayload);
    if (this.mode === "unavailable") {
      return { kind: "unavailable", reason: "Target live provider is not configured; cached data remains visible" };
    }
    if (!this.provider) return { kind: "unavailable", reason: "Target provider mode selected without an approved provider connector" };
    const result = await callProvider((providerContext) => this.provider!.discover(query, providerContext), context, this.policy, "Target");
    return result.kind === "payload" ? parseTargetPayload(result.payload) : result;
  }
}

export function createTargetAdapter(env: AppEnv, provider?: TargetProvider): TargetAdapter {
  return new TargetAdapter(env.TARGET_ADAPTER_MODE, provider, {
    ...DEFAULT_ADAPTER_POLICY,
    maxPagesPerRequest: env.ADAPTER_MAX_PAGES_PER_RUN,
    requestTimeoutMs: env.ADAPTER_REQUEST_TIMEOUT_MS,
    minRequestIntervalMs: env.ADAPTER_MIN_REQUEST_INTERVAL_MS
  });
}
