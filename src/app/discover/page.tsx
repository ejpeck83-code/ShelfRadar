import type { Metadata } from "next";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";
export default async function DiscoverPage() {
  const products = await listProducts();
  return <div className="page"><div className="page-heading"><h1>New discoveries</h1><p className="source-line"><span aria-hidden="true" className="fresh-dot" /> Target fixture · refreshed 5 hours ago</p></div>{products.length ? <div className="product-list">{products.map((product, index) => <ProductRow key={product.id} product={product} priority={index === 0} />)}</div> : <section className="empty-state"><h2>No discoveries yet</h2><p>Run fixture ingestion or check source status. An empty source is not treated as out of stock.</p></section>}</div>;
}
