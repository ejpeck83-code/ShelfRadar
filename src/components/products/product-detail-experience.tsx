import Link from "next/link";
import type { ProductDetailPresentation } from "@/features/presentation/hunt-experience";
import { availabilityLabel, formatCurrency, formatFreshness } from "@/features/presentation/format";
import { ClassificationActions } from "./classification-actions";
import { CopyIdentifier } from "./copy-identifier";
import { EvidenceNotice } from "./evidence-notice";
import { ExternalLink } from "./external-link";
import { ProductThumbnail } from "./product-thumbnail";
import styles from "./hunt-experience.module.css";

function listingStatus(status: string): string {
  if (status === "CROWD_ONLY") return "Crowd evidence only";
  return status.toLowerCase().replaceAll("_", " ");
}

export function ProductDetailExperience({ detail }: { detail: ProductDetailPresentation }) {
  const { product } = detail;
  return (
    <div className={"page " + styles.experience}>
      <Link className={styles.backLink} href="/discover">← Back to Discover</Link>

      <header className={styles.detailHero}>
        <ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority />
        <div>
          <h1>{product.name}</h1>
          <p className={styles.meta}>{product.brand} · {product.line}</p>
          <p className={styles.timestamp}>First detected {formatFreshness(product.firstDetectedAt)}</p>
          <div className={styles.chipRow}>
            {product.retailers.map((retailer) => <span className={styles.chip} key={retailer}>{retailer}</span>)}
          </div>
        </div>
      </header>

      <ClassificationActions productId={product.id} initialState={product.state} />

      <section className={styles.detailSection} aria-labelledby="identifiers-heading">
        <div className={styles.detailSectionHeader}>
          <h2 id="identifiers-heading">Identifiers</h2>
          <span className={styles.summary}>Canonical record</span>
        </div>
        <ul className={styles.identifierGrid} aria-label="Canonical product identifiers">
          {product.identifiers.map((identifier) => (
            <li className={styles.identifier} key={identifier.kind + ":" + identifier.value}>
              <div>
                <span className={styles.identifierKind}>{identifier.kind}</span>
                <p className={styles.identifierValue}>{identifier.value}</p>
              </div>
              <CopyIdentifier kind={identifier.kind} value={identifier.value} />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.detailSection} aria-labelledby="listings-heading">
        <h2 id="listings-heading">Retailer listings</h2>
        <ul className={styles.sectionList}>
          {detail.listings.map((listing) => (
            <li className={styles.listing} key={listing.retailer + listing.url}>
              <div>
                <h3>{listing.retailer}</h3>
                <p>{formatCurrency(listing.priceMinor)} · {listingStatus(listing.status)}</p>
                <p>Checked {formatFreshness(listing.checkedAt)}{listing.sourceAvailable ? "" : " · source unavailable"}</p>
              </div>
              <ExternalLink href={listing.url} label={"Open " + listing.retailer + " listing in a new tab"}>
                Open listing
              </ExternalLink>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.detailSection} aria-labelledby="history-heading">
        <h2 id="history-heading">Availability history</h2>
        {detail.availabilityHistory.length ? (
          <ol className={styles.sectionList}>
            {detail.availabilityHistory.map((observation) => (
              <li className={styles.history} key={observation.id}>
                <div>
                  <h3>{availabilityLabel(observation.status)}</h3>
                  <p>{observation.storeName} · {observation.retailer}</p>
                  {!observation.sourceAvailable ? <p className={styles.unavailable}>Source unavailable; cached status retained</p> : null}
                </div>
                <time dateTime={observation.observedAt}>{formatFreshness(observation.observedAt)}</time>
              </li>
            ))}
          </ol>
        ) : <p className={styles.muted}>No availability observations have been recorded.</p>}
        <p className={styles.truth}><strong>Retailer signals are not proof of shelf inventory.</strong> Items can sell out, be removed, or never reach the sales floor.</p>
      </section>

      <section className={styles.detailSection} aria-labelledby="sightings-heading">
        <h2 id="sightings-heading">Crowd sightings</h2>
        {detail.sightings.map((sighting) => (
          <article className={styles.sighting} key={sighting.id}>
            <div>
              <h3>{sighting.scopeLabel}</h3>
              <p>“{sighting.excerpt}”</p>
              <p>{sighting.source} · {formatFreshness(sighting.observedAt)} · sanitized excerpt</p>
            </div>
            <ExternalLink href={sighting.externalUrl} label={"Open external source for " + sighting.scopeLabel}>
              Open source
            </ExternalLink>
          </article>
        ))}
      </section>

      <section className={styles.detailSection} aria-labelledby="related-heading">
        <h2 id="related-heading">Related wave items</h2>
        {detail.relatedWaveItems.map((item) => (
          <article className={styles.related} key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.relationship}. This relationship is not inferred automatically.</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.detailSection} aria-labelledby="review-heading">
        <h2 id="review-heading">Duplicate and match review</h2>
        <div className={styles.reviewState}>
          <strong>{detail.matchReview.state === "needs-review" ? "Review needed" : "Confirmed match"}</strong>
          {detail.matchReview.explanation}
        </div>
      </section>

      <EvidenceNotice>
        This detail uses cached fixture evidence while lead-owned multi-listing and sighting queries are pending integration.
      </EvidenceNotice>
    </div>
  );
}
