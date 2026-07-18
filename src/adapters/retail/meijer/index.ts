import { z } from "zod";
import fixturePayload from "../../../../tests/fixtures/retail/meijer/discovery.json";
import { rawListingSchema, type AdapterContext, type AdapterResult, type DiscoveryQuery, type RawListing, type RetailDiscoveryAdapter } from "@/domain/adapters";
import { normalizeIdentifier } from "@/domain/identifiers";
import {
  callProvider,
  DEFAULT_ADAPTER_POLICY,
  responseWithinLimit,
  unavailableReason,
  validateDiscoveryQuery,
  type AdapterSafetyPolicy,
  type ApprovedRetailProvider,
  type ListingDetailQuery,
  type RetailAdapterMode
} from "../online/support";

export const MEIJER_PARSER_VERSION = "meijer-approved-v1";

const itemSchema = z.object({
  sku: z.string().min(1).max(80),
  title: z.string().min(1).max(300),
  url: z.url(),
  imageUrl: z.url().optional(),
  brand: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  line: z.string().max(120).optional(),
  productType: z.string().max(80).optional(),
  characters: z.array(z.string().max(100)).max(20).default([]),
  upc: z.string().max(40).optional(),
  priceMinor: z.number().int().nonnegative().optional(),
  state: z.enum(["active", "preorder", "out_of_stock", "removed", "unknown"]),
  availability: z.array(z.object({
    storeId: z.string().min(1).max(80).optional(),
    state: z.enum(["in_stock", "limited", "out_of_stock", "pickup_unavailable", "unknown", "source_unavailable"]),
    observedAt: z.iso.datetime(),
    label: z.string().max(200).optional()
  })).max(100).default([])
});

const envelopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("success"), fetchedAt: z.iso.datetime(), nextCursor: z.string().max(200).optional(), items: z.array(itemSchema).max(200) }),
  z.object({ kind: z.literal("unavailable"), reason: z.string().min(1).max(200), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("throttled"), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("malformed"), reason: z.string().min(1).max(200) })
]);

const listingStatus = { active: "ACTIVE", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", removed: "REMOVED", unknown: "UNKNOWN" } as const;
const availabilityStatus = { in_stock: "IN_STOCK", limited: "LIMITED", out_of_stock: "OUT_OF_STOCK", pickup_unavailable: "PICKUP_UNAVAILABLE", unknown: "UNKNOWN", source_unavailable: "SOURCE_UNAVAILABLE" } as const;

export function parseMeijerPayload(payload: unknown, policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY): AdapterResult<RawListing> {
  if (!responseWithinLimit(payload, policy.maxResponseBytes)) return { kind: "malformed", reason: "Meijer payload exceeded the response-size limit", rawRef: "redacted:oversize-payload" };
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) return { kind: "malformed", reason: "Meijer payload failed source validation", rawRef: "redacted:validation-error" };
  if (parsed.data.kind !== "success") {
    if (parsed.data.kind === "throttled") return { kind: "throttled", ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    if (parsed.data.kind === "unavailable") return { kind: "unavailable", reason: parsed.data.reason, ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    return { kind: "malformed", reason: parsed.data.reason, rawRef: "redacted:provider-malformed" };
  }
  const items: RawListing[] = [];
  for (const item of parsed.data.items) {
    const sku = normalizeIdentifier("MEIJER_SKU", item.sku);
    const identifiers: RawListing["identifiers"] = [{ kind: "MEIJER_SKU", value: sku.valueNormalized, confidence: "EXACT" }];
    if (item.upc) {
      const upc = normalizeIdentifier("UPC", item.upc);
      if (upc.valid && upc.valueNormalized.length === 12) identifiers.push({ kind: "UPC", value: upc.valueNormalized, confidence: "EXACT" });
    }
    const candidate = rawListingSchema.safeParse({
      externalId: sku.valueNormalized,
      title: item.title,
      canonicalUrl: item.url,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.manufacturer ? { manufacturer: item.manufacturer } : {}),
      ...(item.line ? { line: item.line } : {}),
      ...(item.productType ? { productType: item.productType } : {}),
      characters: item.characters,
      identifiers,
      ...(item.priceMinor !== undefined ? { currency: "USD", priceMinor: item.priceMinor } : {}),
      listingStatus: listingStatus[item.state],
      availability: item.availability.map((entry) => ({
        ...(entry.storeId ? { retailerStoreId: entry.storeId } : {}),
        status: availabilityStatus[entry.state],
        observedAt: entry.observedAt,
        ...(entry.label ? { rawLabel: entry.label } : {})
      })),
      provenance: { sourceKey: "meijer", externalId: sku.valueNormalized, fetchedAt: parsed.data.fetchedAt, parserVersion: MEIJER_PARSER_VERSION, rawRef: `provider:meijer:${sku.valueNormalized}` }
    });
    if (!candidate.success) return { kind: "malformed", reason: "Meijer item failed canonical validation", rawRef: `provider:meijer:${sku.valueNormalized}` };
    items.push(candidate.data);
  }
  return { kind: "success", items, fetchedAt: parsed.data.fetchedAt, ...(parsed.data.nextCursor ? { nextCursor: parsed.data.nextCursor } : {}) };
}

export class MeijerAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "meijer";
  readonly capabilities = ["product_discovery", "listing_detail", "store_availability"] as const;
  constructor(private readonly mode: RetailAdapterMode, private readonly provider?: ApprovedRetailProvider, readonly policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY) {}

  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    const invalid = validateDiscoveryQuery(query, this.policy);
    if (invalid) return invalid;
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    if (this.mode === "fixture") return parseMeijerPayload(fixturePayload, this.policy);
    if (this.mode === "unavailable" || !this.provider) return { kind: "unavailable", reason: unavailableReason("Meijer") };
    const result = await callProvider((providerContext) => this.provider!.discover(query, providerContext), context, this.policy, "Meijer");
    return result.kind === "payload" ? parseMeijerPayload(result.payload, this.policy) : result;
  }

  async fetchListing(query: ListingDetailQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    if (!query.externalId || query.externalId.length > 128) return { kind: "malformed", reason: "externalId is invalid" };
    if (this.mode === "fixture") {
      const result = parseMeijerPayload(fixturePayload, this.policy);
      if (result.kind !== "success") return result;
      return { kind: "success", items: result.items.filter((item) => item.externalId === query.externalId), fetchedAt: result.fetchedAt };
    }
    if (this.mode === "unavailable" || !this.provider?.fetchListing) return { kind: "unavailable", reason: unavailableReason("Meijer listing detail") };
    const result = await callProvider((providerContext) => this.provider!.fetchListing!(query, providerContext), context, this.policy, "Meijer listing detail");
    return result.kind === "payload" ? parseMeijerPayload(result.payload, this.policy) : result;
  }
}
