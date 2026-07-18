import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/features/catalog/queries";
import { ClassificationActions } from "@/components/products/classification-actions";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { availabilityLabel, formatCurrency, formatFreshness } from "@/features/presentation/format";

export const metadata: Metadata = { title: "Product detail" };
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = await getProduct(id); if (!product) notFound();
  const latest = product.availability[0];
  return <div className="page detail-page"><Link href="/discover" className="back-link">← Back to Discover</Link><section className="detail-hero"><ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority /><div><h1>{product.name}</h1><p>{product.brand} · {product.line}</p></div></section><ClassificationActions productId={product.id} initialState={product.state} />
    <section className="detail-section"><h2>Identifiers</h2><dl className="identifier-grid">{product.identifiers.map((identifier) => <div key={`${identifier.kind}:${identifier.value}`}><dt>{identifier.kind}</dt><dd>{identifier.value}</dd></div>)}</dl></section>
    <section className="detail-section"><h2>Target listing</h2><div className="listing-row"><div><strong>{product.listing.retailer}</strong><p>{formatCurrency(product.listing.priceMinor)} · {product.listing.status.toLowerCase().replaceAll("_", " ")}</p></div><a href={product.listing.url} target="_blank" rel="noreferrer">Open in Target <span className="sr-only">(opens in a new tab)</span>↗</a></div></section>
    <section className="detail-section"><h2>Latest availability observation</h2>{latest ? <div className="observation"><span className={latest.sourceAvailable ? "fresh-dot" : "neutral-dot"} aria-hidden="true" /><div><strong>{availabilityLabel(latest.status)}</strong><p>{latest.storeName}</p></div><time dateTime={latest.observedAt}>{formatFreshness(latest.observedAt)}</time></div> : <p>No availability observations recorded.</p>}<aside className="truth-note"><strong>Retailer signals are not proof of shelf inventory.</strong><span> Items can sell out, be removed, or never reach the sales floor.</span></aside></section>
    <section className="detail-section"><h2>Product details</h2><dl className="details-list"><div><dt>Brand / line</dt><dd>{product.brand} / {product.line}</dd></div><div><dt>Type</dt><dd>{product.productType}</dd></div><div><dt>Matching</dt><dd>Exact identifier-backed fixture</dd></div></dl></section></div>;
}
