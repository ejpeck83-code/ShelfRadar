import type { CrowdSourceAdapter } from "@/domain/adapters";
import type { CrowdTermConfig } from "@/features/sightings/parser";
import { ingestCrowdPosts, type CrowdSightingRepository } from "@/features/sightings/parser/persistence";
import type { IngestionCounts, IngestionRunRecord } from "./contracts";
import { sanitizeOperationalMessage } from "@/security/sanitize-operational-message";

const JOB_TYPE = "crowd_posts";

export type CrowdDiscoveryRunInput = {
  adapter: CrowdSourceAdapter;
  repository: CrowdSightingRepository;
  now: Date;
  runKey: string;
  terms: CrowdTermConfig;
  queryTerms: string[];
  pageLimit?: number;
};

export async function runCrowdDiscovery(input: CrowdDiscoveryRunInput): Promise<IngestionRunRecord> {
  const counts: IngestionCounts = { fetched: 0, parsed: 0, created: 0, updated: 0, ignored: 0, failed: 0 };
  const run = await input.repository.startRun({
    sourceKey: input.adapter.sourceKey,
    jobType: JOB_TYPE,
    runKey: input.runKey,
    parserVersion: input.adapter.parserVersion ?? "unknown",
    startedAt: input.now
  });
  if (run.status !== "RUNNING") return run;

  const checkpoint = await input.repository.latestCheckpoint(input.adapter.sourceKey, JOB_TYPE);
  let result: Awaited<ReturnType<CrowdSourceAdapter["fetchPosts"]>>;
  try {
    result = await input.adapter.fetchPosts(
      { terms: [...new Set(input.queryTerms)].slice(0, 100), pageLimit: Math.min(input.pageLimit ?? 5, 20), ...(checkpoint ? { checkpoint } : {}) },
      { signal: new AbortController().signal, requestId: input.runKey, now: input.now }
    );
  } catch {
    counts.failed += 1;
    run.counts = counts;
    run.status = "FAILED";
    run.message = "Crowd adapter failed without a structured result";
    await input.repository.finishRun(run);
    return run;
  }
  if (result.kind !== "success") {
    run.status = result.kind === "malformed" ? "FAILED" : "SKIPPED";
    run.message = result.kind === "throttled" ? "Source throttled" : sanitizeOperationalMessage(result.reason);
    run.counts = counts;
    await input.repository.finishRun(run);
    return run;
  }

  counts.fetched = result.items.length;
  counts.parsed = result.items.length;
  try {
    const persisted = await input.repository.inTransaction((repository) => ingestCrowdPosts({ posts: result.items, repository, terms: input.terms, now: input.now }));
    counts.created = persisted.postsCreated + persisted.sightingsCreated + persisted.candidatesCreated;
    counts.ignored = persisted.duplicateEvidence;
    run.counts = counts;
    run.status = "SUCCEEDED";
    if (result.nextCursor) run.cursor = result.nextCursor;
  } catch {
    counts.failed += 1;
    run.counts = counts;
    run.status = "FAILED";
    run.message = "Crowd persistence failed; the prior checkpoint remains active";
    delete run.cursor;
  }
  await input.repository.finishRun(run);
  return run;
}
