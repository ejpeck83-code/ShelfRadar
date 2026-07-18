import fixturePayload from "../../../../tests/fixtures/retail/target/discovery.json";
import { rawListingSchema, type AdapterResult, type DiscoveryQuery, type RawListing, type RetailDiscoveryAdapter, type AdapterContext } from "@/domain/adapters";
import type { AppEnv } from "@/config/env";

export const TARGET_PARSER_VERSION = "target-fixture-v1";

export interface TargetProvider {
  discover(query: DiscoveryQuery, context: AdapterContext): Promise<unknown>;
}

export function parseTargetPayload(payload: unknown): AdapterResult<RawListing> {
  const parsed = rawListingSchema.array().safeParse(payload);
  if (!parsed.success) {
    return { kind: "malformed", reason: "Target payload failed canonical validation", rawRef: "redacted:validation-error" };
  }
  return { kind: "success", items: parsed.data, fetchedAt: parsed.data[0]?.provenance.fetchedAt ?? new Date(0).toISOString() };
}

export class TargetAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "target";
  readonly capabilities = ["product_discovery", "listing_detail", "store_availability"] as const;

  constructor(private readonly mode: AppEnv["TARGET_ADAPTER_MODE"], private readonly provider?: TargetProvider) {}

  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    if (query.pageLimit < 1) return { kind: "malformed", reason: "pageLimit must be positive" };
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    if (this.mode === "fixture") return parseTargetPayload(fixturePayload);
    if (this.mode === "unavailable") {
      return { kind: "unavailable", reason: "Target live provider is not configured; cached data remains visible" };
    }
    if (!this.provider) return { kind: "unavailable", reason: "Target provider mode selected without an approved provider connector" };
    try {
      return parseTargetPayload(await this.provider.discover(query, context));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return { kind: "unavailable", reason: "Target provider timed out" };
      return { kind: "unavailable", reason: "Target provider request failed" };
    }
  }
}

export function createTargetAdapter(env: AppEnv, provider?: TargetProvider): TargetAdapter {
  return new TargetAdapter(env.TARGET_ADAPTER_MODE, provider);
}
