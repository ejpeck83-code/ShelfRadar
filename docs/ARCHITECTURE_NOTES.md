# Architecture Notes — Target Slice

## Decisions

1. **One modular Next.js service.** App Router, ingestion use cases, and PostgreSQL repositories share a deployable unit while maintaining the inward dependency boundaries in `ARCHITECTURE.md`. No worker framework or queue is justified yet.
2. **Canonical Zod boundary.** Retail adapters emit `RawListing`; provider-specific payloads must be parsed into that schema before domain services see them.
3. **Append-only observations.** `availability_observations` has no update path. A latest-value projection is a query concern.
4. **Namespaced identifiers.** The schema stores a non-null namespace (`global:*` or `retailer:*`) so PostgreSQL uniqueness remains correct even when `retailer_id` would otherwise be null.
5. **Matching is conservative.** Exact validated identifiers can match. A title-only resemblance creates a separate product/candidate path. Conflicting exact identifiers create `match_review_items` and stop that listing from silently attaching.
6. **Idempotency at every durable boundary.** Listings, canonical identifier namespaces, observations, state mutations, and ingestion runs have independent unique keys.
7. **Fixture web mode is explicit.** `SHELF_RADAR_DATA_MODE=fixture` provides a deterministic, no-database UI for demos and browser tests. Database mode uses the same view model backed by Drizzle.
8. **Ranking v1 is ordinal and inspectable.** `mvp-v1.1.0` emits label, internal ordering score, factor codes, point direction, evidence reference, and timestamp. Exact product factors outweigh line/wave factors, and the UI never presents the score as a probability.
9. **Production jobs are explicit and serialized.** Cookie-free bearer-authenticated GET/POST routes use per-source PostgreSQL advisory leases and deterministic run keys. The shipped composition allows only the reviewed official NECA Store catalog and Reddit RSS connectors; all other production sources remain unavailable until reviewed and injected.
10. **Cached evidence survives outages.** Current source access is projected separately from persisted listings, observations, posts and sightings. Unavailable never rewrites history or becomes out of stock.

## Raw source retention

Only redacted pointers/content hashes belong in `raw_source_ref`; secrets and full provider payloads do not. Default retention is 30 days (`RAW_SOURCE_RETENTION_DAYS`). Takedowns should remove excerpts/raw material while retaining the minimum audit key needed to prevent re-ingestion.

## Authentication and job endpoints

Local fixture mode uses a development identity and makes no external requests. Production database mode requires one allowlisted owner plus a strong shared secret. Server-only job routes require an independent bearer secret, reject browser cookies, record structured runs, and use advisory locks. The fixture preview is intentionally public and read-only; production data is never served under development authentication.
