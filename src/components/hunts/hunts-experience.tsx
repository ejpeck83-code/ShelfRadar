import Link from "next/link";
import type { ProductView } from "@/features/catalog/view-model";
import type { HuntLeadPresentation } from "@/features/presentation/hunt-experience";
import { formatFreshness } from "@/features/presentation/format";
import { EvidenceNotice } from "@/components/products/evidence-notice";
import { ExperienceEmpty } from "@/components/products/experience-states";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import styles from "@/components/products/hunt-experience.module.css";

const labelText = {
  STRONG: "Strong lead",
  POSSIBLE: "Possible lead",
  WEAK: "Weak lead",
  INSUFFICIENT: "Insufficient evidence"
} as const;

function directionSymbol(direction: "positive" | "negative" | "neutral"): string {
  if (direction === "positive") return "+";
  if (direction === "negative") return "−";
  return "·";
}

export function HuntsExperience({ hunts }: { hunts: Array<{ product: ProductView; leads: HuntLeadPresentation[] }> }) {
  return (
    <div className={"page " + styles.experience}>
      <header className={styles.heading}>
        <div>
          <h1>Hunts</h1>
          <p>Store leads ordered by existing ranking output.</p>
        </div>
        <span className={styles.summary}>{hunts.length} active</span>
      </header>

      <EvidenceNotice>
        Leads combine retailer and crowd evidence. They rank where to check; they never promise shelf inventory.
      </EvidenceNotice>

      {hunts.length ? hunts.map(({ product, leads }) => (
        <section key={product.id} aria-labelledby={"hunt-" + product.id}>
          <div className={styles.huntProduct}>
            <ProductThumbnail name={product.name} imageUrl={product.imageUrl} priority />
            <div>
              <h2 id={"hunt-" + product.id}>{product.name}</h2>
              <p className={styles.meta}>{product.brand} · {product.line}</p>
              <Link className={styles.primaryLink} href={"/products/" + product.id}>View product evidence</Link>
            </div>
          </div>
          <ol className={styles.leadList} aria-label={"Ranked store leads for " + product.name}>
            {leads.map((lead, index) => (
              <li className={styles.lead} key={lead.id}>
                <details className={styles.leadDisclosure} open={index === 0}>
                  <summary>
                    <div className={styles.leadSummary}>
                      <div>
                        <div className={styles.leadHeader}>
                          <h2>{index + 1}. {lead.storeName}</h2>
                          <span className={styles.leadLabel} data-label={lead.rank.label}>{labelText[lead.rank.label]}</span>
                          {lead.scopeLabel ? <span className={styles.scopeChip}>{lead.scopeLabel}</span> : null}
                        </div>
                        <div className={styles.leadMeta}>
                          <span>{lead.retailer} · {lead.retailerStatus}</span>
                          <span className={styles[lead.evidenceTone]}>{lead.evidenceLabel}</span>
                          <span>{lead.storePreferenceLabel}</span>
                        </div>
                      </div>
                      <span className={styles.chevron} aria-hidden="true">⌄</span>
                    </div>
                  </summary>
                  <div className={styles.factorPanel}>
                    <h3>Why this is a {labelText[lead.rank.label].toLowerCase()}</h3>
                    <p className={styles.meta}>{lead.crowdEvidence}. Calculated {formatFreshness(lead.rank.calculatedAt)}.</p>
                    <ul className={styles.factorList}>
                      {lead.rank.factors.map((factor) => (
                        <li className={styles.factor} key={factor.code}>
                          <span className={
                            styles.factorDirection +
                            (factor.direction === "negative" ? " " + styles.factorNegative : "") +
                            (factor.direction === "neutral" ? " " + styles.factorNeutral : "")
                          } aria-hidden="true">
                            {directionSymbol(factor.direction)}
                          </span>
                          <span>{factor.explanation} · {formatFreshness(factor.observedAt)}</span>
                          <span className={styles.factorPoints}>{factor.points > 0 ? "+" : ""}{factor.points}</span>
                        </li>
                      ))}
                    </ul>
                    {lead.rank.factors.length === 0 ? <p className={styles.meta}>No substantive evidence factors are available.</p> : null}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )) : (
        <ExperienceEmpty
          title="No active hunts"
          body="Mark a discovery as Hunt and it will appear here with transparent store leads."
          href="/discover"
          linkLabel="Browse discoveries"
        />
      )}
    </div>
  );
}
