import { z } from "zod";
import fixturePayload from "../../../../tests/fixtures/retail/neca/discovery.json";
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

export const NECA_PARSER_VERSION = "neca-approved-v1";

const itemSchema = z.object({
  productId: z.string().min(1).max(80),
  manufacturerSku: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(300),
  url: z.url(),
  imageUrl: z.url().optional(),
  brand: z.string().max(120).default("NECA"),
  line: z.string().max(120).optional(),
  productType: z.string().max(80).optional(),
  characters: z.array(z.string().max(100)).max(20).default([]),
  upc: z.string().max(40).optional(),
  priceMinor: z.number().int().nonnegative().optional(),
  state: z.enum(["active", "preorder", "out_of_stock", "removed", "unknown"]),
  onlineState: z.enum(["online_only", "preorder", "out_of_stock", "unknown"]),
  releaseDate: z.iso.date().optional()
});

const envelopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("success"), fetchedAt: z.iso.datetime(), nextCursor: z.string().max(200).optional(), items: z.array(itemSchema).max(200) }),
  z.object({ kind: z.literal("unavailable"), reason: z.string().min(1).max(200), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("throttled"), retryAfter: z.iso.datetime().optional() }),
  z.object({ kind: z.literal("malformed"), reason: z.string().min(1).max(200) })
]);

const listingStatus = { active: "ACTIVE", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", removed: "REMOVED", unknown: "UNKNOWN" } as const;
const availabilityStatus = { online_only: "ONLINE_ONLY", preorder: "PREORDER", out_of_stock: "OUT_OF_STOCK", unknown: "UNKNOWN" } as const;

export function parseNecaPayload(payload: unknown, policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY): AdapterResult<RawListing> {
  if (!responseWithinLimit(payload, policy.maxResponseBytes)) return { kind: "malformed", reason: "NECA payload exceeded the response-size limit", rawRef: "redacted:oversize-payload" };
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) return { kind: "malformed", reason: "NECA payload failed source validation", rawRef: "redacted:validation-error" };
  if (parsed.data.kind !== "success") {
    if (parsed.data.kind === "throttled") return { kind: "throttled", ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    if (parsed.data.kind === "unavailable") return { kind: "unavailable", reason: parsed.data.reason, ...(parsed.data.retryAfter ? { retryAfter: parsed.data.retryAfter } : {}) };
    return { kind: "malformed", reason: parsed.data.reason, rawRef: "redacted:provider-malformed" };
  }
  const items: RawListing[] = [];
  for (const item of parsed.data.items) {
    const identifiers: RawListing["identifiers"] = [{ kind: "RETAILER_SKU", value: item.productId.toUpperCase(), confidence: "EXACT" }];
    if (item.manufacturerSku) identifiers.push({ kind: "MANUFACTURER_SKU", value: item.manufacturerSku.toUpperCase(), confidence: "CLAIMED" });
    if (item.upc) {
      const upc = normalizeIdentifier("UPC", item.upc);
      if (upc.valid && upc.valueNormalized.length === 12) identifiers.push({ kind: "UPC", value: upc.valueNormalized, confidence: "EXACT" });
    }
    const candidate = rawListingSchema.safeParse({
      externalId: item.productId.toUpperCase(),
      title: item.title,
      canonicalUrl: item.url,
      ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
      brand: item.brand,
      manufacturer: "NECA",
      ...(item.line ? { line: item.line } : {}),
      ...(item.productType ? { productType: item.productType } : {}),
      characters: item.characters,
      identifiers,
      ...(item.priceMinor !== undefined ? { currency: "USD", priceMinor: item.priceMinor } : {}),
      listingStatus: listingStatus[item.state],
      availability: [{ status: availabilityStatus[item.onlineState], observedAt: parsed.data.fetchedAt, rawLabel: item.onlineState.replaceAll("_", " ") }],
      provenance: { sourceKey: "neca", externalId: item.productId.toUpperCase(), fetchedAt: parsed.data.fetchedAt, parserVersion: NECA_PARSER_VERSION, rawRef: `provider:neca:${item.productId.toUpperCase()}` }
    });
    if (!candidate.success) return { kind: "malformed", reason: "NECA item failed canonical validation", rawRef: `provider:neca:${item.productId.toUpperCase()}` };
    items.push(candidate.data);
  }
  return { kind: "success", items, fetchedAt: parsed.data.fetchedAt, ...(parsed.data.nextCursor ? { nextCursor: parsed.data.nextCursor } : {}) };
}

export class NecaAdapter implements RetailDiscoveryAdapter {
  readonly sourceKey = "neca";
  readonly capabilities = ["product_discovery", "listing_detail"] as const;
  constructor(private readonly mode: RetailAdapterMode, private readonly provider?: ApprovedRetailProvider, readonly policy: AdapterSafetyPolicy = DEFAULT_ADAPTER_POLICY) {}
  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    const invalid = validateDiscoveryQuery(query, this.policy);
    if (invalid) return invalid;
    if (context.signal.aborted) return { kind: "unavailable", reason: "request aborted" };
    if (this.mode === "fixture") return parseNecaPayload(fixturePayload, this.policy);
    if (this.mode === "unavailable" || !this.provider) return { kind: "unavailable", reason: unavailableReason("NECA") };
    const result = await callProvider((providerContext) => this.provider!.discover(query, providerContext), context, this.policy, "NECA");
    return result.kind === "payload" ? parseNecaPayload(result.payload, this.policy) : result;
  }
  async fetchListing(query: ListingDetailQuery, context: AdapterContext): Promise<AdapterResult<RawListing>> {
    if (!query.externalId || query.externalId.length > 128) return { kind: "malformed", reason: "externalId is invalid" };
    if (this.mode === "fixture") {
      const result = parseNecaPayload(fixturePayload, this.policy);
      if (result.kind !== "success") return result;
      return { kind: "success", items: result.items.filter((item) => item.externalId === query.externalId), fetchedAt: result.fetchedAt };
    }
    if (this.mode === "unavailable" || !this.provider?.fetchListing) return { kind: "unavailable", reason: unavailableReason("NECA listing detail") };
    const result = await callProvider((providerContext) => this.provider!.fetchListing!(query, providerContext), context, this.policy, "NECA listing detail");
    return result.kind === "payload" ? parseNecaPayload(result.payload, this.policy) : result;
  }
}
