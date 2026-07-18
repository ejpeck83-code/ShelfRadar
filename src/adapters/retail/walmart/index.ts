import { z } from "zod";
import fixturePayload from "../../../../tests/fixtures/retail/walmart/discovery.json";
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

export const WALMART_PARSER_VERSION = "walmart-approved-v1";

const availabilitySchema = z.object({
  storeId: z.string().min(1).max(80).optional(),
  state: z.enum(["in_stock", "limited", "out_of_stock", "pickup_unavailable", "online_only", "unknown"]),
  observedAt: z.iso.datetime(),
  label: z.string().max(200).optional()
});

const itemSchema = z.object({
  itemId: z.string().regex(/^\d{1,32}$/),
  title: z.string().min(1).max(300),
  url: z.url(),
  imageUrl: z.url().optional(),
  brand: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  line: z.string().max(120).optional(),
  productType: z.string().max(80).optional(),
  characters: z.array(z.string().max(100)).max(20).default([]),
  upc: z.string().max(40).optional(),
  gtin: z.string().max(40).optional(),
  price: z.object({ amountMinor: z.number().int().nonnegative(), currency: z.string().length(3) }).optional(),
  listingState: z.enum(["active", "preorder", "out_of_stock", "removed", "unknown"]),
  availability: z.array(availabilitySchema).max(100).default([])
});

const envelopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("success"), fetchedAt: z.iso.datetime(), nextCursor: z.string().max(200).optional(), items: z.array(itemSchema).max(200) }),
  z.object({ kind: z.literal("unavailable"), reason: z.string().min(1).max(200), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("throttled"), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("malformed"), reason: z.string().min(1).max(200) })
]);

const listingStatus = { active: "ACTIVE", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", removed: "REMOVED", unknown: "UNKNOWN" } as const;
const availabilityStatus = { in_stock: "IN_STOCK", limited: "LIMITED", out_of_stock: "OUT_OF_STOCK", pickup_unavailable: "PICKUP_UNAVAILABLE", online_only: "ONLINE_ONLY", unknown: "UNKNOWN" } as const;

function normalizeGtin(value: string | undefined, kind: "UPC" | "GTIN13"): RawListing["identifiers"][number] | null {
  if (!value) return null;
  const normalized = normalizeIdentifier(kind, value);
  const expectedLength = kind === "UPC" ? 12 : 13;
  return normalized.valid && normalized.valueNormalized.length === expectedLength ? { kind, value: normalized.valueNormalized, confidence: "EXACT" } : null;
}

export function parseWalmartPayload(payload: unknown, policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY): AdapterResult<RawListing> {
  if (!responseWithinLimit(payload, policy.maxResponseBytes)) {
    return { kind: "malformed", reason: "Walmart payload exceeded the response-size limit", rawRef: "redacted:oversize-payload" };
  }
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) return { kind: "malformed", reason: "Walmart payload failed source validation", rawRef: "redacted:validation-error" };
  if (parsed.data.kind !== "success") {
    if (parsed.data.kind === "throttled") return { kind: "throttled", ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    if (parsed.data.kind === "unavailable") return { kind: "unavailable", reason: parsed.data.reason, ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    return { kind: "malformed", reason: parsed.data.reason, rawRef: "redacted:provider-malformed" };
  }
  const items: RawListing[] = [];
  for (const item of parsed.data.items) {
    const identifiers: RawListing["identifiers"] = [{ kind: "WALMART_ITEM_ID", value: item.itemId, confidence: "EXACT" }];
    const upc = normalizeGtin(item.upc, "UPC");
    const gtin = normalizeGtin(item.gtin, "GTIN13");
    if (upc) identifiers.push(upc);
    if (gtin) identifiers.push(gtin);
    const candidate = rawListingSchema.safeParse({
      externalId: item.itemId,
      title: item.title,
      canonicalUrl: item.url,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      ...(item.brand ? { brand: item.brand } : {}),
      ...(item.manufacturer ? { manufacturer: item.manufacturer } : {}),
      ...(item.line ? { line: item.line } : {}),
      ...(item.productType ? { productType: item.productType } : {}),
      characters: item.characters,
      identifiers,
      ...(item.price ? { currency: item.price.currency.toUpperCase(), priceMinor: item.price.amountMinor } : {}),
      listingStatus: listingStatus[item.listingState],
      availability: item.availability.map((entry) => ({
        ...(entry.storeId ? { retailerStoreId: entry.storeId } : {}),
        status: availabilityStatus[entry.state],
        observedAt: entry.observedAt,
        ...(entry.label ? { rawLabel: entry.label } : {})
      })),
      provenance: {
        sourceKey: "walmart",
        externalId: item.itemId,
        fetchedAt: parsed.data.fetchedAt,
        parserVersion: WALMART_PARSER_VERSION,
        rawRef: `provider:walmart:${item.itemId}`
      }
    });
    if (!candidate.success) return { kind: "malformed", reason: "Walmart item failed canonical validation", rawRef: `provider:walmart:${item.itemId}` };
    items.push(candidate.data);
  }
  return { kind: "success", items, fetchedAt: parsed.data.fetchedAt, ...(parsed.data.nextCursor ? { nextCursor: parsed.data.nextCursor } : {}) };
}

export class WalmartAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "walmart";
  readonly capabilities = ["product_discovery", "listing_detail", "store_availability"] as const;

  constructor(
    private readonly mode: RetailAdapterMode,
    private readonly provider?: ApprovedRetailProvider,
    readonly policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY
  ) {}

  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    const invalid = validateDiscoveryQuery(query, this.policy);
    if (invalid) return invalid;
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    if (this.mode === "fixture") return parseWalmartPayload(fixturePayload, this.policy);
    if (this.mode === "unavailable" || !this.provider) return { kind: "unavailable", reason: unavailableReason("Walmart") };
    const result = await callProvider((providerContext) => this.provider!.discover(query, providerContext), context, this.policy, "Walmart");
    return result.kind === "payload" ? parseWalmartPayload(result.payload, this.policy) : result;
  }

  async fetchListing(query: ListingDetailQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    if (!query.externalId || query.externalId.length > 128) return { kind: "malformed", reason: "externalId is invalid" };
    if (this.mode === "fixture") {
      const result = parseWalmartPayload(fixturePayload, this.policy);
      return result.kind === "success"
        ? { kind: "success", items: result.items.filter((item) => item.externalId === query.externalId), fetchedAt: result.fetchedAt }
        : result;
    }
    if (this.mode === "unavailable" || !this.provider?.fetchListing) return { kind: "unavailable", reason: unavailableReason("Walmart listing detail") };
    const result = await callProvider((providerContext) => this.provider!.fetchListing!(query, providerContext), context, this.policy, "Walmart listing detail");
    return result.kind === "payload" ? parseWalmartPayload(result.payload, this.policy) : result;
  }
}
