import { parseEnv } from "@/config/env";
import { createDatabase } from "@/db/client";
import { productStateHistory, userProductStates } from "@/db/schema";
import type { UserProductState } from "@/domain/catalog";
import { setFixtureProductState } from "./fixture-store";

export async function classifyProduct(productId: string, state: UserProductState, mutationId: string): Promise<void> {
  const env = parseEnv();
  if (env.SHELF_RADAR_DATA_MODE === "fixture") return setFixtureProductState(productId, state, mutationId);
  if (!env.DATABASE_URL) throw new Error("Database is not configured");
  const { db, client } = createDatabase(env.DATABASE_URL, { max: 1 });
  try {
    await db.transaction(async (tx) => {
      const row = await tx.insert(userProductStates).values({ userId: "local-owner", productId, state, lastMutationId: mutationId }).onConflictDoUpdate({ target: [userProductStates.userId, userProductStates.productId], set: { state, changedAt: new Date(), lastMutationId: mutationId, updatedAt: new Date() } }).returning({ id: userProductStates.id, lastMutationId: userProductStates.lastMutationId });
      const stateRow = row[0];
      if (!stateRow) throw new Error("Unable to save state");
      await tx.insert(productStateHistory).values({ userProductStateId: stateRow.id, state, mutationId }).onConflictDoNothing({ target: [productStateHistory.userProductStateId, productStateHistory.mutationId] });
    });
  } finally { await client.end(); }
}
