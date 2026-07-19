import { z } from "zod";
import type { AdapterContext, DiscoveryQuery } from "@/domain/adapters";
import { fetchBoundedText } from "@/adapters/http/bounded-fetch";
import type { ApprovedRetailProvider } from "../online/support";

const STOREFRONT_ORIGIN = "https://store.necaonline.com";
const COLLECTION_PATH = "/collections/teenage-mutant-ninja-turtles/products.json";
const PAGE_SIZE = 50;

const variantSchema = z.object({
  id: z.number().int().positive(),
  sku: z.string().max(120).nullable().optional(),
  available: z.boolean(),
  price: z.string().regex(/^\d{1,8}\.\d{2}$/)
}).passthrough();

const storefrontProductSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(1_000),
  handle: z.string().min(1).max(300).regex(/^[a-z0-9-]+$/),
  published_at: z.iso.datetime({ offset: true }).nullable().optional(),
  updated_at: z.iso.datetime({ offset: true }),
  vendor: z.string().max(200).optional(),
  product_type: z.string().max(120).optional(),
  tags: z.array(z.string().max(200)).max(100).default([]),
  variants: z.array(variantSchema).min(1).max(100),
  images: z.array(z.object({ src: z.url().max(2_048) }).passthrough()).max(100).default([])
}).passthrough();

const storefrontPageSchema = z.object({ products: z.array(storefrontProductSchema).max(PAGE_SIZE) });

type StorefrontOptions = {
  requestTimeoutMs?: number;
  minRequestIntervalMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
};

type NecaProviderEnvelope =
  | { kind: "success"; fetchedAt: string; items: NecaProviderItem[] }
  | { kind: "unavailable"; reason: string; retryAfter?: string }
  | { kind: "throttled"; retryAfter?: string }
  | { kind: "malformed"; reason: string };

type NecaProviderItem = {
  productId: string;
  manufacturerSku?: string;
  title: string;
  url: string;
  imageUrl?: string;
  brand: string;
  line?: string;
  productType?: string;
  characters: string[];
  priceMinor: number;
  state: "active" | "preorder" | "out_of_stock";
  onlineState: "online_only" | "preorder" | "out_of_stock";
};

export class NecaStorefrontProvider implements ApprovedRetailProvider {
  private readonly requestTimeoutMs: number;
  private readonly minRequestIntervalMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly options: StorefrontOptions = {}) {
    this.requestTimeoutMs = Math.max(100, Math.min(60_000, options.requestTimeoutMs ?? 15_000));
    this.minRequestIntervalMs = Math.max(0, Math.min(60_000, options.minRequestIntervalMs ?? 1_000));
    this.maxResponseBytes = Math.max(1_024, Math.min(5_000_000, options.maxResponseBytes ?? 1_500_000));
  }

  async discover(query: DiscoveryQuery, context: AdapterContext): Promise<NecaProviderEnvelope> {
    const items: NecaProviderItem[] = [];
    const pageLimit = Math.max(1, Math.min(5, query.pageLimit));
    for (let page = 1; page <= pageLimit; page += 1) {
      if (page > 1 && this.minRequestIntervalMs > 0) await delay(this.minRequestIntervalMs, context.signal);
      const url = new URL(COLLECTION_PATH, STOREFRONT_ORIGIN);
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("page", String(page));
      const response = await fetchBoundedText(url, {
        allowedHostname: "store.necaonline.com",
        sourceLabel: "NECA Store",
        signal: context.signal,
        now: context.now,
        requestTimeoutMs: this.requestTimeoutMs,
        maxResponseBytes: this.maxResponseBytes,
        headers: { accept: "application/json", "user-agent": "ShelfRadar/0.1 read-only catalog" },
        ...(this.options.fetchImpl ? { fetchImpl: this.options.fetchImpl } : {})
      });
      if (response.kind !== "success") return response;
      let payload: unknown;
      try { payload = JSON.parse(response.text) as unknown; }
      catch { return { kind: "malformed", reason: "NECA Store response was not valid JSON" }; }
      const parsed = storefrontPageSchema.safeParse(payload);
      if (!parsed.success) return { kind: "malformed", reason: "NECA Store response failed source validation" };
      items.push(...parsed.data.products.map(normalizeProduct));
      if (parsed.data.products.length < PAGE_SIZE) break;
    }
    return { kind: "success", fetchedAt: context.now.toISOString(), items };
  }

  async fetchListing(): Promise<NecaProviderEnvelope> {
    return { kind: "unavailable", reason: "NECA Store detail refresh uses bounded collection discovery" };
  }
}

function normalizeProduct(product: z.infer<typeof storefrontProductSchema>): NecaProviderItem {
  const variant = product.variants.find((candidate) => candidate.available) ?? product.variants[0]!;
  const available = product.variants.some((candidate) => candidate.available);
  const preorder = /pre[ -]?order/i.test(`${product.title} ${product.tags.join(" ")}`);
  const state = !available ? "out_of_stock" : preorder ? "preorder" : "active";
  const onlineState = !available ? "out_of_stock" : preorder ? "preorder" : "online_only";
  const line = /\(([^)]+)\)/.exec(product.title)?.[1]?.trim().slice(0, 120);
  const imageUrl = approvedShopifyImage(product.images[0]?.src);
  const manufacturerSku = product.variants.map((candidate) => candidate.sku?.trim()).find(Boolean)?.slice(0, 80);
  return {
    productId: String(product.id),
    ...(manufacturerSku ? { manufacturerSku } : {}),
    title: product.title.slice(0, 300),
    url: `${STOREFRONT_ORIGIN}/products/${product.handle}`,
    ...(imageUrl ? { imageUrl } : {}),
    brand: "NECA",
    ...(line ? { line } : {}),
    ...(product.product_type ? { productType: product.product_type.slice(0, 80) } : {}),
    characters: [],
    priceMinor: Number(variant.price.replace(".", "")),
    state,
    onlineState
  };
}

function approvedShopifyImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.shopify.com" && url.pathname.startsWith("/s/files/") ? url.toString() : undefined;
  } catch { return undefined; }
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
