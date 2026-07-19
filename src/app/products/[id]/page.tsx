import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/features/catalog/queries";
import { ClassificationActions } from "@/components/products/classification-actions";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { availabilityLabel, formatCurrency, formatFreshness } from "@/features/presentation/format";
import { listSignals } from "@/features/signals/queries";

export const metadata: Metadata = { title: "Product detail" };
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const product = await getProduct(id); if (!product) notFound();
  const observations = product.listings.flatMap((listing) => listing.availability.map((observation) => ({ ...observation, listing })));
  const relatedSignals = (await listSignals({ productId: product.id, retailer: "ross" })).signals.slice(0, 3);
  return <div className="page detail-page"><Link href="/discover" className="back-link">← Back to Discover</Link><section className="detail-hero"><ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority /><div><h1>{product.name}</h1><p>{product.brand} · {product.line}</p></div></section><ClassificationActions productId={product.id} initialState={product.state} />
    <section className="detail-section"><h2>Identifiers</h2><dl className="identifier-grid">{product.identifiers.map((identifier) => <div key={`${identifier.kind}:${identifier.value}`}><dt>{identifier.kind}</dt><dd>{identifier.value}</dd></div>)}</dl></section>
    <section className="detail-section"><h2>Retailer listings</h2><div className="listing-list">{product.listings.map((listing) => <div className="listing-row" key={listing.id}><div><strong>{listing.retailer}</strong><p>{formatCurrency(listing.priceMinor)} · {listing.status.toLowerCase().replaceAll("_", " ")}</p></div><a href={listing.url} target="_blank" rel="noreferrer noopener">Open at {listing.retailer} <span className="sr-only">(opens in a new tab)</span>↗</a></div>)}</div></section>
    <section className="detail-section"><h2>Availability observations</h2>{observations.length ? <div className="observation-list">{observations.map((item) => <div className="observation" key={`${item.listing.id}:${item.storeName}:${item.observedAt}`}><span className={item.sourceAvailable ? "fresh-dot" : "neutral-dot"} aria-hidden="true" /><div><strong>{availabilityLabel(item.status)}</strong><p>{item.storeName} · {item.listing.retailer}</p></div><time dateTime={item.observedAt}>{formatFreshness(item.observedAt)}</time></div>)}</div> : <p>No availability observations recorded.</p>}<aside className="truth-note"><strong>Retailer signals are not proof of shelf inventory.</strong><span> Items can sell out, be removed, or never reach the sales floor.</span></aside></section>
    {relatedSignals.length ? <section className="detail-section"><h2>Related public sightings</h2>{relatedSignals.map((signal) => <article className="related-signal" key={signal.id}><div className="signal-meta"><span className={`scope-badge scope-${signal.locationScope.toLowerCase()}`}>{signal.locationLabel}</span>{signal.reviewRequired ? <span className="review-badge">Product match needs review</span> : null}</div><h3>{signal.title}</h3><p>{signal.reviewRequired ? "Crowd evidence with an unconfirmed product match; not a retailer inventory observation." : "Crowd evidence only; not a retailer inventory observation."}</p><a href={signal.permalink} target="_blank" rel="noreferrer noopener">Open public post <span className="sr-only">(opens in a new tab)</span>↗</a></article>)}</section> : null}
    <section className="detail-section"><h2>Product details</h2><dl className="details-list"><div><dt>Brand / line</dt><dd>{product.brand} / {product.line}</dd></div><div><dt>Type</dt><dd>{product.productType}</dd></div><div><dt>Matching</dt><dd>{product.matchingSummary}</dd></div></dl></section></div>;
}
