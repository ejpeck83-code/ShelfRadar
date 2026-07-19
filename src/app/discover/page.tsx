import type { Metadata } from "next";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";
import { parseEnv } from "@/config/env";
import { buildSourceMatrix } from "@/features/sources/status";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";
export default async function DiscoverPage() {
  const products = await listProducts();
  const env = parseEnv();
  const allUnavailable = buildSourceMatrix(env).every((source) => source.state === "unavailable");
  return <div className="page"><div className="page-heading"><h1>New discoveries</h1><p className="source-line"><span aria-hidden="true" className="fresh-dot" /> {env.SHELF_RADAR_DATA_MODE === "fixture" ? "Integrated fixture demo · Target, Walmart, Meijer, NECA, online" : "Persisted catalog · check source status for current access"}</p></div><aside className="partial-banner"><strong>{allUnavailable ? "All external sources unavailable; showing cached data." : "Evidence, not shelf certainty."}</strong> Listings and observations can be stale or incomplete; unavailable sources remain distinct from out of stock.</aside>{products.length ? <div className="product-list">{products.map((product, index) => <ProductRow key={product.id} product={product} priority={index === 0} />)}</div> : <section className="empty-state"><h2>No discoveries yet</h2><p>Run fixture ingestion or check source status. An empty source is not treated as out of stock.</p></section>}</div>;
}
