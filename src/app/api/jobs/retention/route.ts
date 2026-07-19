import { NextResponse } from "next/server";
import { parseEnv } from "@/config/env";
import { applyRawSourceRetention } from "@/operations/retention";
import { withPostgresLease } from "@/operations/postgres-lease";
import { isAuthorizedJob } from "@/security/owner-auth";

async function runRetention(request: Request) {
  const env = parseEnv();
  if (!isAuthorizedJob(request, env)) return NextResponse.json({ error: "Unauthorized job request" }, { status: 401, headers: { "cache-control": "no-store" } });
  if (!env.DATABASE_URL || env.SHELF_RADAR_DATA_MODE !== "database") return NextResponse.json({ error: "Database retention is not configured" }, { status: 503 });
  const result = await withPostgresLease(env.DATABASE_URL, "retention:raw-source", (db) => applyRawSourceRetention(db, new Date(), env.RAW_SOURCE_RETENTION_DAYS));
  if (!result.acquired) return NextResponse.json({ error: "Retention is already running" }, { status: 409, headers: { "retry-after": "60" } });
  return NextResponse.json({ cutoff: result.value.cutoff.toISOString(), redactedCrowdPosts: result.value.redactedCrowdPosts });
}

export const GET = runRetention;
export const POST = runRetention;
