import { z } from "zod";
import { parseEnv } from "../src/config/env";
import { withPostgresLease } from "../src/operations/postgres-lease";
import { runRegisteredSourceJob } from "../src/operations/run-source-job";

const sourceSchema = z.enum(["neca", "reddit"]);

const sourceKey = sourceSchema.parse(process.argv[2] ?? "neca");
const env = parseEnv();
if (!env.DATABASE_URL || env.SHELF_RADAR_DATA_MODE !== "database" || !env.LIVE_INGESTION_ENABLED) {
  throw new Error("Live source jobs require database mode, DATABASE_URL, and LIVE_INGESTION_ENABLED=true");
}

const now = new Date();
const executionId = process.env.GITHUB_RUN_ID ?? now.toISOString().slice(0, 16);
const attempt = process.env.GITHUB_RUN_ATTEMPT ?? "1";
const runKey = `github:${sourceKey}:${executionId}:${attempt}`;
const result = await withPostgresLease(env.DATABASE_URL, `ingestion:${sourceKey}`, (db) =>
  runRegisteredSourceJob({ env, db, sourceKey, now, runKey })
);

if (!result.acquired) throw new Error(`${sourceKey} ingestion is already running`);

const { status, counts, message } = result.value;
console.log(JSON.stringify({ source: sourceKey, runKey, status, counts, message: message ?? null }));
if (status !== "SUCCEEDED" && status !== "PARTIAL") process.exitCode = 1;
