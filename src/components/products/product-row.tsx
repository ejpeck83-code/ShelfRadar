import Link from "next/link";
import type { ProductView } from "@/features/catalog/view-model";
import { ClassificationActions } from "./classification-actions";
import { ProductThumbnail } from "./product-thumbnail";
import { formatFreshness, formatIdentifier } from "@/features/presentation/format";

export function ProductRow({ product, priority = false, readOnly = false }: { product: ProductView; priority?: boolean; readOnly?: boolean }) {
  return <article className="product-row"><Link className="product-link" href={`/products/${product.id}`} aria-label={`Open ${product.name}`}><ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority={priority} /><div className="product-copy"><h2>{product.name}</h2><p>{product.brand} · {product.line}</p><p>First detected {formatFreshness(product.firstDetectedAt)}</p><div className="source-chips" aria-label="Retailer listings">{product.listings.map((listing) => <span key={listing.id}>{listing.retailer}{listing.sourceState === "fixture-only" ? " · fixture" : listing.sourceState === "pending-sanctioned-access" ? " · pending sanctioned access" : listing.sourceState === "unavailable" ? " · cached" : " · live"}</span>)}</div><p className="identifiers">{product.identifiers.slice(0, 3).map(formatIdentifier).join(" · ")}</p></div><span className="chevron" aria-hidden="true">›</span></Link><div className="row-actions"><ClassificationActions productId={product.id} initialState={product.state} readOnly={readOnly} /></div></article>;
}
