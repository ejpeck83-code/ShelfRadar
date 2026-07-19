import { desc, eq } from "drizzle-orm";
import type { AppEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { ingestionRuns } from "@/db/schema";

export type LatestSourceRun = {
  sourceKey: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  message?: string;
  lastSucceededAt?: string;
  counts: { fetched: number; parsed: number; created: number; updated: number; ignored: number; failed: number };
};

type SourceRunRow = typeof ingestionRuns.$inferSelect;

export function summarizeSourceRuns(rows: readonly SourceRunRow[]): LatestSourceRun[] {
  const latestBySource = new Map<string, SourceRunRow>();
  const lastSuccessBySource = new Map<string, string>();
  for (const run of rows) {
    if (!latestBySource.has(run.sourceKey)) latestBySource.set(run.sourceKey, run);
    if (!lastSuccessBySource.has(run.sourceKey) && run.status === "SUCCEEDED") lastSuccessBySource.set(run.sourceKey, (run.finishedAt ?? run.startedAt).toISOString());
  }
  return [...latestBySource.values()].map((run) => {
    const lastSucceededAt = lastSuccessBySource.get(run.sourceKey);
    return {
      sourceKey: run.sourceKey,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      ...(run.finishedAt ? { finishedAt: run.finishedAt.toISOString() } : {}),
      ...(run.sanitizedMessage ? { message: run.sanitizedMessage } : {}),
      ...(lastSucceededAt ? { lastSucceededAt } : {}),
      counts: { fetched: run.fetchedCount, parsed: run.parsedCount, created: run.createdCount, updated: run.updatedCount, ignored: run.ignoredCount, failed: run.failedCount }
    };
  });
}

export async function listLatestSourceRuns(env: AppEnv): Promise<LatestSourceRun[]> {
  if (env.SHELF_RADAR_DATA_MODE !== "database" || !env.DATABASE_URL) return [];
  const { db, client } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    const [latest, lastSuccessful] = await Promise.all([
      db.selectDistinctOn([ingestionRuns.sourceKey]).from(ingestionRuns).orderBy(ingestionRuns.sourceKey, desc(ingestionRuns.startedAt)),
      db.selectDistinctOn([ingestionRuns.sourceKey]).from(ingestionRuns).where(eq(ingestionRuns.status, "SUCCEEDED")).orderBy(ingestionRuns.sourceKey, desc(ingestionRuns.startedAt))
    ]);
    return summarizeSourceRuns([...latest, ...lastSuccessful]);
  } finally {
    await client.end();
  }
}
