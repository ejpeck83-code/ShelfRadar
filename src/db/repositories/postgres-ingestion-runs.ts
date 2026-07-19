import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { ShelfRadarQueryDb } from "@/db/client";
import { ingestionRuns } from "@/db/schema";
import type { IngestionRunRecord, IngestionRunRepository } from "@/ingestion/contracts";

type StartRunInput = Parameters<IngestionRunRepository["startRun"]>[0];

export async function startPostgresIngestionRun(db: ShelfRadarQueryDb, input: StartRunInput): Promise<IngestionRunRecord> {
  const inserted = await db.insert(ingestionRuns).values({
    sourceKey: input.sourceKey,
    jobType: input.jobType,
    startedAt: input.startedAt,
    status: "RUNNING",
    parserVersion: input.parserVersion,
    runKey: input.runKey
  }).onConflictDoNothing({ target: ingestionRuns.runKey }).returning();
  const row = inserted[0] ?? (await db.select().from(ingestionRuns).where(eq(ingestionRuns.runKey, input.runKey)).limit(1))[0];
  if (!row) throw new Error("Unable to create ingestion run");
  return postgresRunFromRow(row);
}

export async function finishPostgresIngestionRun(db: ShelfRadarQueryDb, run: IngestionRunRecord): Promise<void> {
  await db.update(ingestionRuns).set({
    status: run.status,
    finishedAt: new Date(),
    fetchedCount: run.counts.fetched,
    parsedCount: run.counts.parsed,
    createdCount: run.counts.created,
    updatedCount: run.counts.updated,
    ignoredCount: run.counts.ignored,
    failedCount: run.counts.failed,
    cursor: run.cursor ?? null,
    sanitizedMessage: run.message?.slice(0, 500) ?? null
  }).where(eq(ingestionRuns.id, run.id));
}

export async function latestPostgresCheckpoint(db: ShelfRadarQueryDb, sourceKey: string, jobType: string): Promise<string | undefined> {
  const row = (await db.select({ cursor: ingestionRuns.cursor }).from(ingestionRuns).where(and(
    eq(ingestionRuns.sourceKey, sourceKey),
    eq(ingestionRuns.jobType, jobType),
    eq(ingestionRuns.status, "SUCCEEDED"),
    isNotNull(ingestionRuns.cursor)
  )).orderBy(desc(ingestionRuns.finishedAt), desc(ingestionRuns.startedAt)).limit(1))[0];
  return row?.cursor ?? undefined;
}

export function postgresRunFromRow(row: typeof ingestionRuns.$inferSelect): IngestionRunRecord {
  return {
    id: row.id,
    runKey: row.runKey,
    sourceKey: row.sourceKey,
    jobType: row.jobType,
    parserVersion: row.parserVersion,
    startedAt: row.startedAt,
    status: row.status,
    counts: {
      fetched: row.fetchedCount,
      parsed: row.parsedCount,
      created: row.createdCount,
      updated: row.updatedCount,
      ignored: row.ignoredCount,
      failed: row.failedCount
    },
    ...(row.cursor ? { cursor: row.cursor } : {}),
    ...(row.sanitizedMessage ? { message: row.sanitizedMessage } : {})
  };
}
