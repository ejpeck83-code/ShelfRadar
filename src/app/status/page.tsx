import type { Metadata } from "next";
import { parseEnv } from "@/config/env";
import { createRetailAdapterRegistry } from "@/adapters/retail/registry";
import { createCrowdAdapterRegistry } from "@/adapters/crowd/registry";
export const metadata: Metadata = { title: "Source status" };
export const dynamic = "force-dynamic";
export default async function StatusPage() {
  const env = parseEnv(); const adapters = [...createRetailAdapterRegistry(env).values(), ...createCrowdAdapterRegistry(env).values()];
  const context = { signal: new AbortController().signal, requestId: "status", now: new Date("2026-07-18T21:00:00.000Z") };
  const statuses = await Promise.all(adapters.map(async (adapter) => {
    const result = "fetchPosts" in adapter ? await adapter.fetchPosts({ terms: ["TMNT"], pageLimit: 1 }, context) : await adapter.discover({ terms: ["TMNT"], pageLimit: 1 }, context);
    return { adapter, result, fixture: configuredMode(env, adapter.sourceKey) === "fixture" && result.kind === "success" };
  }));
  return <div className="page"><div className="page-heading"><h1>Source status</h1><p>Owner-visible adapter health and capability declarations.</p></div><div className="status-list">{statuses.map(({ adapter, result, fixture }) => <article key={adapter.sourceKey}><div><h2>{sourceName(adapter.sourceKey)}</h2><p>{adapter.capabilities.join(" · ").replaceAll("_", " ")}</p></div><div className={fixture ? "status-ok" : "status-muted"}><strong>{fixture ? "Fixture ready" : result.kind === "throttled" ? "Throttled" : "Unavailable"}</strong><span>{fixture ? "Deterministic synthetic data; no live request" : result.kind === "unavailable" ? result.reason : "No approved live connector is active"}</span></div></article>)}</div><aside className="truth-note"><strong>Live ingestion is off by default.</strong><span> Provider/OAuth modes require explicit enablement, approved credentials, and an approved connector. Source failure never means out of stock.</span></aside></div>;
}
function sourceName(key: string): string { return ({ target: "Target", walmart: "Walmart", meijer: "Meijer", neca: "NECA", online: "Online retailers", reddit: "Reddit / Ross Finds" } as Record<string, string>)[key] ?? key; }
function configuredMode(env: ReturnType<typeof parseEnv>, key: string): string { return ({ target: env.TARGET_ADAPTER_MODE, walmart: env.WALMART_ADAPTER_MODE, meijer: env.MEIJER_ADAPTER_MODE, neca: env.NECA_ADAPTER_MODE, online: env.ONLINE_RETAIL_ADAPTER_MODE, reddit: env.REDDIT_ADAPTER_MODE } as Record<string, string>)[key] ?? "unavailable"; }
