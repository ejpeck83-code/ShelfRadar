import type { Metadata } from "next";
import { parseEnv } from "@/config/env";
import { listLatestSourceRuns } from "@/features/sources/queries";
import { buildSourceMatrix } from "@/features/sources/status";

export const metadata: Metadata = { title: "Source status" };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const env = parseEnv();
  const sources = buildSourceMatrix(env);
  const latestRuns = new Map((await listLatestSourceRuns(env)).map((run) => [run.sourceKey, run]));
  return <div className="page"><div className="page-heading"><h1>Source status</h1><p>Owner-visible source mode, capabilities, and latest persisted run.</p></div><div className="status-list">{sources.map((source) => {
    const run = latestRuns.get(source.key);
    return <article key={source.key}><div><h2>{source.label}</h2><p>{source.state === "pending-sanctioned-access" ? "Requested capability" : "Capability"}: {source.capabilities.join(" · ")}</p></div><div className={["live", "fixture-only"].includes(source.state) ? "status-ok" : "status-muted"}><strong>{source.state === "fixture-only" ? "Fixture-only" : source.state === "live" ? "Live" : source.state === "pending-sanctioned-access" ? "Pending sanctioned access" : "Unavailable"}</strong><span>{source.note}</span>{run ? <><span>Latest run: {run.status.toLowerCase()} · {new Date(run.finishedAt ?? run.startedAt).toLocaleString("en-US", { timeZone: env.APP_TIME_ZONE })}{run.message ? ` · ${run.message}` : ""}</span><span>Counts: {run.counts.fetched} fetched · {run.counts.created} created · {run.counts.updated} updated · {run.counts.failed} failed</span><span>{run.lastSucceededAt ? `Last success: ${new Date(run.lastSucceededAt).toLocaleString("en-US", { timeZone: env.APP_TIME_ZONE })}` : "No successful run recorded"}</span></> : <span>No persisted run yet</span>}</div></article>;
  })}</div><aside className="truth-note"><strong>Evidence is timestamped, not guaranteed.</strong><span> Live sources are explicitly labeled. Source failure never means out of stock.</span></aside></div>;
}
