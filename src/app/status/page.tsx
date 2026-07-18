import type { Metadata } from "next";
import { parseEnv } from "@/config/env";
import { createRetailAdapterRegistry } from "@/adapters/retail/registry";
export const metadata: Metadata = { title: "Source status" };
export const dynamic = "force-dynamic";
export default function StatusPage() {
  const env = parseEnv(); const adapters = [...createRetailAdapterRegistry(env).values()];
  return <div className="page"><div className="page-heading"><h1>Source status</h1><p>Owner-visible adapter health and capability declarations.</p></div><div className="status-list">{adapters.map((adapter) => { const fixture = adapter.sourceKey === "target" && env.TARGET_ADAPTER_MODE === "fixture"; return <article key={adapter.sourceKey}><div><h2>{sourceName(adapter.sourceKey)}</h2><p>{adapter.capabilities.join(" · ").replaceAll("_", " ")}</p></div><div className={fixture ? "status-ok" : "status-muted"}><strong>{fixture ? "Fixture ready" : "Unavailable"}</strong><span>{fixture ? "Deterministic CI data; no live request" : "No live connector in Target milestone"}</span></div></article>; })}</div><aside className="truth-note"><strong>Live Target access is off.</strong><span> Provider mode requires both the explicit live-ingestion flag and approved credentials.</span></aside></div>;
}
function sourceName(key: string): string { return ({ target: "Target", walmart: "Walmart", meijer: "Meijer", neca: "NECA", online: "Online retailers" } as Record<string, string>)[key] ?? key; }
