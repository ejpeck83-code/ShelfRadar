import { z } from "zod";
import bigBadToyStoreFixture from "../../../../tests/fixtures/retail/online/bigbadtoystore/discovery.json";
import { rawListingSchema, type AdapterContext, type AdapterResult, type DiscoveryQuery, type RawListing, type RetailDiscoveryAdapter } from "@/domain/adapters";
import { normalizeIdentifier } from "@/domain/identifiers";
import {
  callProvider,
  DEFAULT_ADAPTER_POLICY,
  responseWithinLimit,
  urlMatchesAllowedHosts,
  unavailableReason,
  validateDiscoveryQuery,
  type AdapterSafetyPolicy,
  type ApprovedRetailProvider,
  type ListingDetailQuery,
  type RetailAdapterMode
} from "./support";

export const ONLINE_PARSER_VERSION = "online-allowlist-v1";
export const ONLINE_RETAILER_ALLOWLIST = ["bigbadtoystore"] as const;
export type OnlineRetailerKey = (typeof ONLINE_RETAILER_ALLOWLIST)[number];
export type OnlineRetailerConfig = { readonly retailer: OnlineRetailerKey; readonly mode: RetailAdapterMode };

const sourceConfig: Record<OnlineRetailerKey, { label: string; allowedHosts: readonly string[]; fixture: unknown }> = {
  bigbadtoystore: { label: "BigBadToyStore", allowedHosts: ["www.bigbadtoystore.com", "bigbadtoystore.com"], fixture: bigBadToyStoreFixture }
};

const itemSchema = z.object({
  retailerSku: z.string().min(1).max(80), title: z.string().min(1).max(300), url: z.url(), imageUrl: z.url().optional(),
  brand: z.string().max(120).optional(), manufacturer: z.string().max(120).optional(), line: z.string().max(120).optional(),
  productType: z.string().max(80).optional(), characters: z.array(z.string().max(100)).max(20).default([]), gtin: z.string().max(40).optional(),
  priceMinor: z.number().int().nonnegative().optional(), state: z.enum(["active", "preorder", "out_of_stock", "removed", "unknown"]),
  onlineState: z.enum(["online_only", "preorder", "out_of_stock", "unknown"])
});

const envelopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("success"), fetchedAt: z.iso.datetime(), nextCursor: z.string().max(200).optional(), items: z.array(itemSchema).max(100) }),
  z.object({ kind: z.literal("unavailable"), reason: z.string().min(1).max(200), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("throttled"), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("malformed"), reason: z.string().min(1).max(200) })
]);

const listingStatus = { active: "ACTIVE", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", removed: "REMOVED", unknown: "UNKNOWN" } as const;
const availabilityStatus = { online_only: "ONLINE_ONLY", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", unknown: "UNKNOWN" } as const;

export function parseOnlineRetailerPayload(retailer: OnlineRetailerKey, payload: unknown, policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY): AdapterResult<RawListing> {
  if (!responseWithinLimit(payload, policy.maxResponseBytes)) return { kind: "malformed", reason: "Online retailer payload exceeded the response-size limit", rawRef: "redacted:oversize-payload" };
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) return { kind: "malformed", reason: "Online retailer payload failed source validation", rawRef: "redacted:validation-error" };
  if (parsed.data.kind !== "success") {
    if (parsed.data.kind === "throttled") return { kind: "throttled", ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    if (parsed.data.kind === "unavailable") return { kind: "unavailable", reason: parsed.data.reason, ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    return { kind: "malformed", reason: parsed.data.reason, rawRef: "redacted:provider-malformed" };
  }
  const config = sourceConfig[retailer];
  const items: RawListing[] = [];
  for (const item of parsed.data.items) {
    if (!urlMatchesAllowedHosts(item.url, config.allowedHosts)) return { kind: "malformed", reason: "Online retailer item URL is outside the configured allowlist", rawRef: "redacted:disallowed-host" };
    const sku = normalizeIdentifier("RETAILER_SKU", item.retailerSku);
    const identifiers: RawListing["identifiers"] = [{ kind: "RETAILER_SKU", value: sku.valueNormalized, confidence: "EXACT" }];
    if (item.gtin) {
      const digitLength = item.gtin.replace(/\D/g, "").length;
      const gtinKind = digitLength === 13 ? "GTIN13" : digitLength === 12 ? "UPC" : null;
      if (gtinKind) {
        const gtin = normalizeIdentifier(gtinKind, item.gtin);
        if (gtin.valid) identifiers.push({ kind: gtinKind, value: gtin.valueNormalized, confidence: "EXACT" });
      }
    }
    const externalId = `${retailer}:${sku.valueNormalized}`;
    const candidate = rawListingSchema.safeParse({
      externalId, title: item.title, canonicalUrl: item.url, ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(item.brand ? { brand: item.brand } : {}), ...(item.manufacturer ? { manufacturer: item.manufacturer } : {}),
      ...(item.line ? { line: item.line } : {}), ...(item.productType ? { productType: item.productType } : {}), characters: item.characters,
      identifiers, ...(item.priceMinor !== undefined ? { currency: "USD", priceMinor: item.priceMinor } : {}), listingStatus: listingStatus[item.state],
      availability: [{ status: availabilityStatus[item.onlineState], observedAt: parsed.data.fetchedAt, rawLabel: item.onlineState.replaceAll("_", " ") }],
      provenance: { sourceKey: "online", externalId, fetchedAt: parsed.data.fetchedAt, parserVersion: ONLINE_PARSER_VERSION, rawRef: `provider:online:${externalId}` }
    });
    if (!candidate.success) return { kind: "malformed", reason: "Online retailer item failed canonical validation", rawRef: `provider:online:${externalId}` };
    items.push(candidate.data);
  }
  return { kind: "success", items, fetchedAt: parsed.data.fetchedAt, ...(parsed.data.nextCursor ? { nextCursor: parsed.data.nextCursor } : {}) };
}

export class ConfiguredOnlineRetailerAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "online";
  readonly parserVersion = ONLINE_PARSER_VERSION;
  readonly capabilities = ["product_discovery", "listing_detail"] as const;
  constructor(readonly config: OnlineRetailerConfig, private readonly provider?: ApprovedRetailProvider, readonly policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY) {}
  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    const invalid = validateDiscoveryQuery(query, this.policy);
    if (invalid) return invalid;
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    const selected = sourceConfig[this.config.retailer];
    if (this.config.mode === "fixture") return parseOnlineRetailerPayload(this.config.retailer, selected.fixture, this.policy);
    if (this.config.mode === "unavailable" || !this.provider) return { kind: "unavailable", reason: unavailableReason(selected.label) };
    const result = await callProvider((providerContext) => this.provider!.discover(query, providerContext), context, this.policy, selected.label);
    return result.kind === "payload" ? parseOnlineRetailerPayload(this.config.retailer, result.payload, this.policy) : result;
  }
  async fetchListing(query: ListingDetailQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    if (!query.externalId || query.externalId.length > 128) return { kind: "malformed", reason: "externalId is invalid" };
    const selected = sourceConfig[this.config.retailer];
    if (this.config.mode === "fixture") {
      const result = parseOnlineRetailerPayload(this.config.retailer, selected.fixture, this.policy);
      if (result.kind !== "success") return result;
      return { kind: "success", items: result.items.filter((item) => item.externalId === query.externalId), fetchedAt: result.fetchedAt };
    }
    if (this.config.mode === "unavailable" || !this.provider?.fetchListing) return { kind: "unavailable", reason: unavailableReason(`${selected.label} listing detail`) };
    const result = await callProvider((providerContext) => this.provider!.fetchListing!(query, providerContext), context, this.policy, `${selected.label} listing detail`);
    return result.kind === "payload" ? parseOnlineRetailerPayload(this.config.retailer, result.payload, this.policy) : result;
  }
}
