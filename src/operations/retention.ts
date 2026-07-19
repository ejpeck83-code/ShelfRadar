import { and, isNotNull, lt, or } from "drizzle-orm";
import type { ShelfRadarQueryDb } from "@/db/client";
import { crowdPosts } from "@/db/schema";

export type RetentionResult = { cutoff: Date; redactedCrowdPosts: number };

export function retentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1_000);
}

export async function applyRawSourceRetention(db: ShelfRadarQueryDb, now: Date, retentionDays: number): Promise<RetentionResult> {
  const cutoff = retentionCutoff(now, retentionDays);
  const redacted = await db
    .update(crowdPosts)
    .set({ bodyExcerpt: null, authorDisplay: null, rawSourceRef: null, updatedAt: now })
    .where(and(
      lt(crowdPosts.fetchedAt, cutoff),
      or(isNotNull(crowdPosts.bodyExcerpt), isNotNull(crowdPosts.authorDisplay), isNotNull(crowdPosts.rawSourceRef))
    ))
    .returning({ id: crowdPosts.id });
  return { cutoff, redactedCrowdPosts: redacted.length };
}
