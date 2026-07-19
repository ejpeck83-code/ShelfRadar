"use client";

import { useMemo, useState } from "react";
import type { SignalPresentation } from "@/features/presentation/hunt-experience";
import { filterSignals } from "@/features/presentation/hunt-experience";
import { formatFreshness } from "@/features/presentation/format";
import { EvidenceNotice } from "@/components/products/evidence-notice";
import { ExperienceEmpty } from "@/components/products/experience-states";
import { ExternalLink } from "@/components/products/external-link";
import styles from "@/components/products/hunt-experience.module.css";

type Filters = { kind: string; retailer: string; scope: string; freshness: string; product: string };
const initialFilters: Filters = { kind: "all", retailer: "all", scope: "all", freshness: "all", product: "all" };

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filter}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function SignalsExperience({ signals }: { signals: SignalPresentation[] }) {
  const [filters, setFilters] = useState(initialFilters);
  const visible = useMemo(() => filterSignals(signals, filters), [signals, filters]);
  const products = Array.from(new Map(signals.filter((signal) => signal.productId).map((signal) => [signal.productId, signal.productName])).entries());

  function setFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className={"page " + styles.experience}>
      <header className={styles.heading}>
        <div>
          <h1>Signals</h1>
          <p>Chronological evidence with explicit source and location scope.</p>
        </div>
      </header>

      <EvidenceNotice>
        Reddit is currently unavailable. Cached, sanitized evidence remains visible below with original timestamps.
      </EvidenceNotice>

      <form className={styles.filters} aria-label="Filter signals" onSubmit={(event) => event.preventDefault()}>
        <FilterSelect
          label="Signal type"
          value={filters.kind}
          onChange={(value) => setFilter("kind", value)}
          options={[
            { value: "all", label: "All signal types" },
            { value: "discovery", label: "Discovery" },
            { value: "availability", label: "Availability change" },
            { value: "crowd", label: "Crowd sighting" },
            { value: "ross", label: "Ross crowd-inventory" },
            { value: "source-health", label: "Source health" }
          ]}
        />
        <FilterSelect
          label="Retailer"
          value={filters.retailer}
          onChange={(value) => setFilter("retailer", value)}
          options={[
            { value: "all", label: "All retailers" },
            { value: "Ross", label: "Ross" },
            { value: "Target", label: "Target" }
          ]}
        />
        <FilterSelect
          label="Scope"
          value={filters.scope}
          onChange={(value) => setFilter("scope", value)}
          options={[
            { value: "all", label: "All scopes" },
            { value: "local", label: "Local" },
            { value: "regional", label: "Regional" },
            { value: "national", label: "National" },
            { value: "unknown", label: "Unknown location" }
          ]}
        />
        <FilterSelect
          label="Freshness"
          value={filters.freshness}
          onChange={(value) => setFilter("freshness", value)}
          options={[
            { value: "all", label: "Any freshness" },
            { value: "fresh", label: "Fresh" },
            { value: "stale", label: "Stale" }
          ]}
        />
        <FilterSelect
          label="Product"
          value={filters.product}
          onChange={(value) => setFilter("product", value)}
          options={[
            { value: "all", label: "All products" },
            ...products.map(([value, label]) => ({ value: value ?? "", label: label ?? "Unknown product" }))
          ]}
        />
        <p className={styles.filterCount} role="status">{visible.length} signals shown</p>
      </form>

      {visible.length ? (
        <ol className={styles.signalList} aria-label="Chronological signals">
          {visible.map((signal) => (
            <li className={styles.signal} key={signal.id}>
              <span className={styles.signalMarker} data-kind={signal.kind} aria-hidden="true" />
              <article className={styles.signalBody}>
                <div className={styles.signalTop}>
                  <span className={styles.scopeChip}>{signal.scopeLabel}</span>
                  <span className={signal.freshness === "fresh" ? styles.fresh : styles.stale}>{formatFreshness(signal.occurredAt)}</span>
                </div>
                <h2>{signal.title}</h2>
                <p>{signal.description}</p>
                {signal.excerpt ? <p className={styles.excerpt}>“{signal.excerpt}”</p> : null}
                <footer className={styles.signalFooter}>
                  <span>{signal.retailer} · {signal.source}</span>
                  {signal.productName ? <span>{signal.productName}</span> : null}
                  {!signal.sourceAvailable ? <span className={styles.unavailable}>Source unavailable · cached evidence</span> : null}
                  {signal.externalUrl ? (
                    <ExternalLink href={signal.externalUrl} label={"Open external source for " + signal.title}>
                      Open source
                    </ExternalLink>
                  ) : null}
                </footer>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <ExperienceEmpty
          title="No signals match these filters"
          body="Broaden one or more filters. The source-unavailable state is not treated as an empty inventory result."
        />
      )}
    </div>
  );
}
