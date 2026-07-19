import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ShelfRadarDb } from "@/db/client";
import * as schema from "@/db/schema";

export type LeaseResult<T> = { acquired: false } | { acquired: true; value: T };

export async function withPostgresLease<T>(databaseUrl: string, leaseKey: string, operation: (db: ShelfRadarDb) => Promise<T>): Promise<LeaseResult<T>> {
  const client = postgres(databaseUrl, {
    max: 2,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    connection: {
      statement_timeout: 60_000,
      lock_timeout: 5_000,
      idle_in_transaction_session_timeout: 60_000
    }
  });
  const db = drizzle(client, { schema });
  let reserved: Awaited<ReturnType<typeof client.reserve>> | undefined;
  let acquired = false;
  try {
    reserved = await client.reserve();
    const rows = await reserved<{ acquired: boolean }[]>`select pg_try_advisory_lock(hashtextextended(${leaseKey}, 0)) as acquired`;
    acquired = rows[0]?.acquired === true;
    if (!acquired) return { acquired: false };
    return { acquired: true, value: await operation(db) };
  } finally {
    try {
      if (acquired && reserved) await reserved`select pg_advisory_unlock(hashtextextended(${leaseKey}, 0))`;
    } finally {
      reserved?.release();
      await client.end();
    }
  }
}
