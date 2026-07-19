import type { Metadata } from "next";
import Link from "next/link";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";
import { ProductThumbnail } from "@/components/products/product-thumbnail";
import { buildFieldCheckTasks, buildHuntLeads, type FieldCheckTaskView } from "@/features/hunts/queries";
import { formatFreshness } from "@/features/presentation/format";
import { parseEnv } from "@/config/env";

export const metadata: Metadata = { title: "Hunts" };
export const dynamic = "force-dynamic";

type HuntsPageProps = {
  searchParams?: Promise<{ fieldCheck?: string }>;
};

export default async function HuntsPage({ searchParams }: HuntsPageProps) {
  const env = parseEnv();
  const params = await searchParams;
  const fixtureMode = env.SHELF_RADAR_DATA_MODE === "fixture";
  const readOnlyPreview = env.NODE_ENV === "production" && fixtureMode;
  const hunts = (await listProducts()).filter((product) => product.state === "HUNT");
  const calculatedAt = fixtureMode ? new Date("2026-07-18T21:00:00.000Z") : new Date();
  const tasks = buildFieldCheckTasks(hunts, { calculatedAt, includeFixtureCrowd: fixtureMode });
  return (
    <div className="page">
      <div className="page-heading">
        <h1>Hunts</h1>
        <p>Today’s field board: what to check, what you last saw, and quick links for the aisle.</p>
      </div>
      {feedback(params?.fieldCheck)}
      {fixtureMode ? <aside className="partial-banner"><strong>Fixture ranking demo.</strong> Manual field checks are read-only in fixture mode; production records them as owner observations.</aside> : null}
      {hunts.length ? (
        <>
          <section className="hunt-group" aria-labelledby="field-board-title">
            <h2 id="field-board-title" className="section-kicker">Field board</h2>
            {tasks.length ? <div className="field-board">{tasks.map((task, index) => <FieldCheckCard key={task.id} task={task} priority={index === 0} now={calculatedAt} readOnly={readOnlyPreview} />)}</div> : <p className="insufficient-note">Your active hunts are online-only right now. Use Product Detail links and keep watching for physical-store listings.</p>}
          </section>
          <section className="hunt-group" aria-labelledby="ranked-evidence-title">
            <h2 id="ranked-evidence-title" className="section-kicker">Ranked evidence by product</h2>
            {hunts.map((product, productIndex) => {
              const leads = buildHuntLeads(product, { calculatedAt, includeFixtureCrowd: fixtureMode });
              return (
                <section className="hunt-product-group" key={product.id} aria-labelledby={`hunt-${product.id}`}>
                  <ProductRow product={product} priority={productIndex === 0} />
                  <h3 id={`hunt-${product.id}`} className="section-kicker">Evidence</h3>
                  <div className="lead-list">{leads.length ? leads.map((lead) => <article className="lead-summary" key={lead.id}><div className="lead-title"><h4>{lead.name} · {lead.label}</h4>{lead.scopeLabel ? <span className="scope-badge scope-named">{lead.scopeLabel}</span> : null}</div><p>{lead.sourceNote}. Calculated {new Date(lead.calculatedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}.</p>{lead.factors.length ? lead.factors.map((factor) => <div className={`factor factor-${factor.direction}`} key={`${factor.code}:${factor.evidenceRef}`}><span>{factor.points > 0 ? "+" : ""}{factor.points}</span><p>{factor.explanation} · observed {new Date(factor.observedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</p></div>) : <p className="insufficient-note">No store-specific evidence. This lead is intentionally labeled insufficient.</p>}</article>) : <p className="insufficient-note">No store-specific evidence is available. Online listings are not ranked as store leads.</p>}</div>
                </section>
              );
            })}
          </section>
        </>
      ) : <section className="empty-state"><h2>No active hunts</h2><p>Mark a discovery as Hunt and it will appear here with check cards, direct links, and transparent evidence.</p><a className="primary-link" href="/discover">Browse discoveries</a></section>}
    </div>
  );
}

function FieldCheckCard({ task, priority, now, readOnly }: { task: FieldCheckTaskView; priority: boolean; now: Date; readOnly: boolean }) {
  return (
    <article className={`field-card${task.shouldCheckToday ? " field-card-due" : ""}`}>
      <div className="field-card-main">
        <ProductThumbnail name={task.productName} imageUrl={task.productImageUrl} priority={priority} />
        <div>
          <div className="field-card-title"><h3>{task.storeName}</h3><span className={`scope-badge ${task.shouldCheckToday ? "scope-regional" : "scope-named"}`}>{task.shouldCheckToday ? "Check today" : "Recently checked"}</span></div>
          <p className="field-product"><Link href={`/products/${task.productId}`}>{task.productName}</Link></p>
          <p>{task.retailer}{task.storeLocation ? ` · ${task.storeLocation}` : ""}</p>
        </div>
      </div>
      <dl className="field-status">
        <div><dt>Last signal</dt><dd>{task.lastSignalAt ? `${task.statusText} · ${formatFreshness(task.lastSignalAt, now)}` : task.statusText}</dd></div>
        <div><dt>Your last check</dt><dd>{task.lastManualCheckAt ? `${task.lastManualCheckLabel ?? "Field check"} · ${formatFreshness(task.lastManualCheckAt, now)}` : "No field check recorded"}</dd></div>
        <div><dt>Lead</dt><dd>{task.lead.label}</dd></div>
      </dl>
      <div className="field-actions">
        {task.actionLinks.map((link) => <a key={`${link.kind}:${link.url}`} href={link.url} target="_blank" rel="noreferrer noopener">{link.label}<span className="sr-only"> opens in a new tab</span> ↗</a>)}
      </div>
      <form className="field-check-form" action="/api/hunts/field-check" method="post">
        <input type="hidden" name="next" value="/hunts" />
        <input type="hidden" name="productId" value={task.productId} />
        <input type="hidden" name="listingId" value={task.listingId} />
        <input type="hidden" name="storeId" value={task.storeId ?? ""} />
        <input type="hidden" name="mutationId" value={crypto.randomUUID()} />
        <label><span className="sr-only">Optional field check note</span><input name="note" maxLength={160} placeholder="Optional note: peg empty, saw 2, messy NECA section" disabled={readOnly} /></label>
        <div className="field-check-buttons">
          <button type="submit" name="status" value="OUT_OF_STOCK" disabled={readOnly}>Checked none</button>
          <button type="submit" name="status" value="UNKNOWN" disabled={readOnly}>Checked unsure</button>
          <button type="submit" name="status" value="LIMITED" disabled={readOnly}>Saw limited</button>
          <button type="submit" name="status" value="IN_STOCK" disabled={readOnly}>Saw it</button>
        </div>
      </form>
      <p className="field-note">{task.sourceNote}. Manual checks are evidence for you; they are not retailer inventory claims.</p>
    </article>
  );
}

function feedback(value: string | undefined) {
  if (!value) return null;
  const messages: Record<string, string> = {
    recorded: "Field check recorded.",
    duplicate: "That field check was already recorded.",
    "fixture-readonly": "Fixture mode is read-only; production records field checks.",
    invalid: "That field check could not be saved because the form was invalid.",
    failed: "That field check could not be saved."
  };
  return <aside className={value === "recorded" || value === "duplicate" ? "truth-note" : "partial-banner"}>{messages[value] ?? "Field check status updated."}</aside>;
}
