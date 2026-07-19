import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDatabase(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 5, prepare: false });
  return { db: drizzle(client, { schema }), client };
}

export type ShelfRadarDb = ReturnType<typeof createDatabase>["db"];
export type ShelfRadarTransaction = Parameters<Parameters<ShelfRadarDb["transaction"]>[0]>[0];
export type ShelfRadarQueryDb = ShelfRadarDb | ShelfRadarTransaction;
