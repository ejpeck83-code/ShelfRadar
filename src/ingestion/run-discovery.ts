import { createHash } from "node:crypto";
import type { RetailDiscoveryAdapter } from "@/domain/adapters";
import { matchProduct } from "@/matching/match-product";
import type { CatalogRepository, IngestionCounts, IngestionRunRecord } from "./contracts";

export type DiscoveryRunInput = { adapter: RetailDiscoveryAdapter; repository: CatalogRepository; now: Date; runKey: string; terms: string[]; pageLimit?: number };

export async function runDiscovery(input: DiscoveryRunInput): Promise<IngestionRunRecord> {
  const counts: IngestionCounts = { fetched: 0, parsed: 0, created: 0, updated: 0, ignored: 0, failed: 0 };
  const run = await input.repository.startRun({ sourceKey: input.adapter.sourceKey, runKey: input.runKey, parserVersion: input.adapter.parserVersion ?? "unknown", startedAt: input.now });
  if (run.status !== "RUNNING") return run;
  const controller = new AbortController();
  const result = await input.adapter.discover(
    { terms: [...new Set(input.terms)].slice(0, 20), pageLimit: Math.min(input.pageLimit ?? 5, 5) },
    { signal: controller.signal, requestId: input.runKey, now: input.now }
  );
  if (result.kind !== "success") {
    run.status = result.kind === "malformed" ? "FAILED" : "SKIPPED";
    run.message = result.kind === "throttled" ? "Source throttled" : result.reason;
    run.counts = counts;
    await input.repository.finishRun(run);
    return run;
  }

  counts.fetched = result.items.length;
  for (const listing of result.items) {
    counts.parsed += 1;
    const existingListingProductId = await input.repository.findProductByExternalListing(input.adapter.sourceKey, listing.externalId);
    let productId = existingListingProductId;
    if (!productId) {
      const candidates = await input.repository.findMatchCandidates(listing, input.adapter.sourceKey);
      const decision = matchProduct(listing, candidates, input.adapter.sourceKey);
      if (decision.kind === "review") {
        await input.repository.createMatchReview({ sourceKey: input.adapter.sourceKey, externalListingId: listing.externalId, candidateProductIds: decision.candidateProductIds, reasonCode: decision.reason });
        counts.failed += 1;
        continue;
      }
      productId = decision.kind === "match" ? decision.productId : await input.repository.createProductFromListing(listing);
      if (decision.kind === "create") counts.created += 1;
    } else {
      counts.updated += 1;
    }
    await input.repository.touchProduct(productId, new Date(listing.provenance.fetchedAt));
    const savedListing = await input.repository.upsertListing(productId, input.adapter.sourceKey, listing);
    if (savedListing.created && existingListingProductId) counts.updated += 1;
    await input.repository.upsertIdentifiers(productId, input.adapter.sourceKey, savedListing.id, listing);
    await input.repository.appendAvailability(savedListing.id, input.adapter.sourceKey, listing);
  }
  run.counts = counts;
  run.status = counts.failed === 0 ? "SUCCEEDED" : counts.created + counts.updated > 0 ? "PARTIAL" : "FAILED";
  await input.repository.finishRun(run);
  return run;
}

export function ingestionIdempotencyKey(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u001f")).digest("hex");
}
