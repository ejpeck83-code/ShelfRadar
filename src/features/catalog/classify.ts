import { parseEnv } from "@/config/env";
import { and, eq } from "drizzle-orm";
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
      const inserted = await tx.insert(userProductStates).values({ userId: "local-owner", productId, state, lastMutationId: mutationId }).onConflictDoNothing({ target: [userProductStates.userId, userProductStates.productId] }).returning({ id: userProductStates.id });
      let stateRow = inserted[0];
      if (!stateRow) {
        stateRow = (await tx.select({ id: userProductStates.id }).from(userProductStates).where(and(eq(userProductStates.userId, "local-owner"), eq(userProductStates.productId, productId))).for("update").limit(1))[0];
        if (!stateRow) throw new Error("Unable to load product state");
        const replay = await tx.select({ id: productStateHistory.id }).from(productStateHistory).where(and(eq(productStateHistory.userProductStateId, stateRow.id), eq(productStateHistory.mutationId, mutationId))).limit(1);
        if (replay.length) return;
        const changedAt = new Date();
        await tx.update(userProductStates).set({ state, changedAt, lastMutationId: mutationId, updatedAt: changedAt }).where(eq(userProductStates.id, stateRow.id));
      }
      await tx.insert(productStateHistory).values({ userProductStateId: stateRow.id, state, mutationId }).onConflictDoNothing({ target: [productStateHistory.userProductStateId, productStateHistory.mutationId] });
    });
  } finally { await client.end(); }
}
