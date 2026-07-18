import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/db/client";

const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_DIRECT_URL or DATABASE_URL is required to migrate");
const { db, client } = createDatabase(url, { max: 1 });
try {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Shelf Radar migrations applied.");
} finally {
  await client.end();
}
