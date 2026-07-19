import { NextResponse } from "next/server";
import { z } from "zod";
import { parseEnv } from "@/config/env";
import { SOURCE_KEYS } from "@/features/sources/status";
import { isAuthorizedJob } from "@/security/owner-auth";
import { withPostgresLease } from "@/operations/postgres-lease";
import { runRegisteredSourceJob, scheduledRunKey } from "@/operations/run-source-job";

const sourceSchema = z.enum(SOURCE_KEYS);

type RouteContext = { params: Promise<{ source: string }> };

async function runSource(request: Request, { params }: RouteContext) {
  const env = parseEnv();
  if (!isAuthorizedJob(request, env)) return NextResponse.json({ error: "Unauthorized job request" }, { status: 401, headers: { "cache-control": "no-store" } });
  const parsedSource = sourceSchema.safeParse((await params).source);
  if (!parsedSource.success) return NextResponse.json({ error: "Unknown source" }, { status: 404 });
  if (!env.DATABASE_URL || env.SHELF_RADAR_DATA_MODE !== "database") return NextResponse.json({ error: "Database ingestion is not configured" }, { status: 503 });
  const now = new Date();
  const runKey = scheduledRunKey(parsedSource.data, now);
  const result = await withPostgresLease(env.DATABASE_URL, `ingestion:${parsedSource.data}`, (db) => runRegisteredSourceJob({ env, db, sourceKey: parsedSource.data, now, runKey }));
  if (!result.acquired) return NextResponse.json({ error: "Source ingestion is already running" }, { status: 409, headers: { "retry-after": "60" } });
  return NextResponse.json({ source: parsedSource.data, runKey, status: result.value.status, counts: result.value.counts, message: result.value.message ?? null });
}

export const GET = runSource;
export const POST = runSource;
