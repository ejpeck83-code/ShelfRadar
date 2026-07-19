import type { Metadata } from "next";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";
import { parseEnv } from "@/config/env";
import { buildSourceMatrix } from "@/features/sources/status";
import { retailerSearchActionLink } from "@/features/retailer-links";
import type { ProductView, RetailerActionLink } from "@/features/catalog/view-model";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

type DiscoverSearchParams = {
  q?: string;
  showIgnored?: string;
};

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<DiscoverSearchParams> }) {
  const params = await searchParams;
  const query = normalizeQuery(params.q);
  const products = await listProducts();
  const env = parseEnv();
  const allUnavailable = buildSourceMatrix(env).every((source) => !["live", "fixture-only"].includes(source.state));
  const readOnlyPreview = env.NODE_ENV === "production" && env.SHELF_RADAR_DATA_MODE === "fixture";
  const matchingProducts = query ? products.filter((product) => productMatchesQuery(product, query)) : products;
  const activeProducts = matchingProducts.filter((product) => product.state !== "IGNORE");
  const ignoredProducts = matchingProducts.filter((product) => product.state === "IGNORE");
  const searchLinks = query ? buildSearchLinks(query) : [];
  const ignoredSectionOpen = params.showIgnored === "1" || (query.length > 0 && activeProducts.length === 0 && ignoredProducts.length > 0);

  return <div className="page"><div className="page-heading"><h1>New discoveries</h1><p className="source-line"><span aria-hidden="true" className="fresh-dot" /> {env.SHELF_RADAR_DATA_MODE === "fixture" ? "Integrated fixture demo · Target, Walmart, Meijer, NECA, online" : "Persisted catalog · check source status for current access"}</p></div><form className="discover-search" role="search" aria-label="Search Shelf Radar discoveries"><label htmlFor="discover-query">Search figures</label><div><input id="discover-query" name="q" type="search" placeholder="Try Last Ronin, Leonardo, UPC…" defaultValue={params.q ?? ""} /><button type="submit">Search</button></div>{query ? <a href="/discover">Clear search</a> : null}</form>{query ? <section className="truth-note search-help"><strong>Looking for a brand-new drop?</strong><span> Shelf Radar searches your persisted catalog first. If it is not here yet, use the retailer search shortcuts below; they open official search pages and do not claim live inventory.</span><div className="search-actions" aria-label="Retailer search shortcuts">{searchLinks.map((link) => <a key={link.label} href={link.url} target="_blank" rel="noreferrer noopener">{link.label}<span className="sr-only"> for {query} (opens in a new tab)</span> ↗</a>)}</div></section> : null}<aside className="partial-banner"><strong>{allUnavailable ? "All external sources unavailable; showing cached data." : "Evidence, not shelf certainty."}</strong> Listings and observations can be stale or incomplete; unavailable sources remain distinct from out of stock.</aside>{matchingProducts.length ? <>{activeProducts.length ? <div className="product-list" aria-label={query ? `Catalog matches for ${query}` : "Discovered products"}>{activeProducts.map((product, index) => <ProductRow key={product.id} product={product} priority={index === 0} readOnly={readOnlyPreview} />)}</div> : <section className="empty-state"><h2>{query ? "No active catalog matches" : "No active discoveries"}</h2><p>{ignoredProducts.length ? "Only ignored products match this search. Open the ignored section below if you want to restore one." : "Try another search or use the official retailer search shortcuts. A missing record does not mean a figure is unavailable."}</p></section>}{ignoredProducts.length ? <details className="ignored-products" open={ignoredSectionOpen}><summary>Ignored products ({ignoredProducts.length})</summary><p>Ignored items are kept out of your main Discover and Hunts flow, but the catalog history and product detail remain available.</p><div className="product-list">{ignoredProducts.map((product) => <ProductRow key={product.id} product={product} readOnly={readOnlyPreview} />)}</div></details> : null}</> : <section className="empty-state"><h2>{query ? "No catalog matches" : "No discoveries yet"}</h2><p>{query ? "Use the official retailer search shortcuts above to scout outside Shelf Radar, then new approved-source ingestions can add records later." : "Run fixture ingestion or check source status. An empty source is not treated as out of stock."}</p></section>}</div>;
}

function normalizeQuery(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function productMatchesQuery(product: ProductView, query: string): boolean {
  const haystack = [
    product.name,
    product.brand,
    product.line,
    product.productType,
    product.matchingSummary,
    ...product.identifiers.flatMap((identifier) => [identifier.kind, identifier.value]),
    ...product.listings.flatMap((listing) => [listing.retailer, listing.status, listing.retailerKey])
  ].join(" ").toLowerCase();
  return query.toLowerCase().split(" ").every((token) => haystack.includes(token));
}

function buildSearchLinks(query: string): RetailerActionLink[] {
  return [
    retailerSearchActionLink("target", "Target", query, []),
    retailerSearchActionLink("walmart", "Walmart", query, []),
    retailerSearchActionLink("meijer", "Meijer", query, []),
    retailerSearchActionLink("neca", "NECA Store", query, [])
  ].filter((link): link is RetailerActionLink => link !== null);
}
