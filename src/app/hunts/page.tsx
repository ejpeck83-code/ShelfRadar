import type { Metadata } from "next";
import { listProducts } from "@/features/catalog/queries";
import { ProductRow } from "@/components/products/product-row";
import { buildHuntLeads } from "@/features/hunts/queries";
import { parseEnv } from "@/config/env";

export const metadata: Metadata = { title: "Hunts" };
export const dynamic = "force-dynamic";
export default async function HuntsPage() {
  const env = parseEnv();
  const fixtureMode = env.SHELF_RADAR_DATA_MODE === "fixture";
  const hunts = (await listProducts()).filter((product) => product.state === "HUNT");
  const calculatedAt = fixtureMode ? new Date("2026-07-18T21:00:00.000Z") : new Date();
  return <div className="page"><div className="page-heading"><h1>Hunts</h1><p>Store and crowd leads for products you are actively looking for.</p></div>{fixtureMode ? <aside className="partial-banner"><strong>Fixture ranking demo.</strong> Synthetic retailer observations and public crowd reports exercise transparent factors without live access.</aside> : null}{hunts.length ? hunts.map((product, productIndex) => { const leads = buildHuntLeads(product, { calculatedAt, includeFixtureCrowd: fixtureMode }); return <section className="hunt-group" key={product.id} aria-labelledby={`hunt-${product.id}`}><ProductRow product={product} priority={productIndex === 0} /><h2 id={`hunt-${product.id}`} className="section-kicker">Ranked leads</h2><div className="lead-list">{leads.length ? leads.map((lead) => <article className="lead-summary" key={lead.id}><div className="lead-title"><h3>{lead.name} · {lead.label}</h3>{lead.scopeLabel ? <span className="scope-badge scope-named">{lead.scopeLabel}</span> : null}</div><p>{lead.sourceNote}. Calculated {new Date(lead.calculatedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}.</p>{lead.factors.length ? lead.factors.map((factor) => <div className={`factor factor-${factor.direction}`} key={`${factor.code}:${factor.evidenceRef}`}><span>{factor.points > 0 ? "+" : ""}{factor.points}</span><p>{factor.explanation} · observed {new Date(factor.observedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })}</p></div>) : <p className="insufficient-note">No store-specific evidence. This lead is intentionally labeled insufficient.</p>}</article>) : <p className="insufficient-note">No store-specific evidence is available. Online listings are not ranked as store leads.</p>}</div></section>; }) : <section className="empty-state"><h2>No active hunts</h2><p>Mark a discovery as Hunt and it will appear here with transparent store leads.</p><a className="primary-link" href="/discover">Browse discoveries</a></section>}</div>;
}
