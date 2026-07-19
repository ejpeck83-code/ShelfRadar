import Link from "next/link";
import type { DiscoverProductPresentation } from "@/features/presentation/hunt-experience";
import { formatFreshness, formatIdentifier } from "@/features/presentation/format";
import { ClassificationActions } from "@/components/products/classification-actions";
import { EvidenceNotice } from "@/components/products/evidence-notice";
import { ExperienceEmpty } from "@/components/products/experience-states";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import styles from "@/components/products/hunt-experience.module.css";

export function DiscoverExperience({ products }: { products: DiscoverProductPresentation[] }) {
  return (
    <div className={"page " + styles.experience}>
      <header className={styles.heading}>
        <div>
          <h1>New discoveries</h1>
          <p>Review newly detected canonical TMNT products.</p>
        </div>
        <span className={styles.summary}>{products.length} to classify</span>
      </header>

      <EvidenceNotice>
        Target fixture refreshed 5 hours ago. Reddit is unavailable; cached crowd evidence remains visible elsewhere with timestamps.
      </EvidenceNotice>

      {products.length ? (
        <ol className={styles.productList} aria-label="New products">
          {products.map((product, index) => (
            <li key={product.id}>
              <article className={styles.productCard}>
                <Link className={styles.productLink} href={"/products/" + product.id} aria-label={"Open " + product.name}>
                  <ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority={index === 0} />
                  <div className={styles.productCopy}>
                    <h2>{product.name}</h2>
                    <p className={styles.meta}>{product.brand} · {product.line}</p>
                    <p className={styles.timestamp}>First detected {formatFreshness(product.firstDetectedAt)}</p>
                    <p className={styles.identifierLine}>{product.identifiers.slice(0, 3).map(formatIdentifier).join(" · ")}</p>
                    <div className={styles.chipRow} aria-label="Retailers and review state">
                      {product.retailers.map((retailer) => <span className={styles.chip} key={retailer}>{retailer}</span>)}
                      {product.matchReview === "needs-review" ? <span className={styles.reviewChip}>Match review</span> : null}
                    </div>
                  </div>
                  <span className={styles.chevron} aria-hidden="true">›</span>
                </Link>
                <ClassificationActions productId={product.id} initialState={product.state} />
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <ExperienceEmpty
          title="No discoveries yet"
          body="No cached products match this view. An empty result is not treated as an out-of-stock signal."
          href="/status"
          linkLabel="Check source status"
        />
      )}
    </div>
  );
}
