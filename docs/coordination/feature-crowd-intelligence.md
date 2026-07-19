# Coordination — feature/crowd-intelligence

## Summary

Implemented an isolated Reddit crowd adapter, sanitized post normalization, deterministic sighting/location extraction, Ross crowd-inventory scopes, conservative product candidate matching through the existing exact-identifier service, provenance-preserving deduplication, and PostgreSQL persistence using the existing crowd tables. No Hunt UI, ranking weights, schema, migrations, retail adapters, auth, or shared domain contracts were changed.

The assigned `../shelf-radar-crowd` worktree and `feature/crowd-intelligence` branch did not exist and were created from refreshed `origin/main` at `0feb435b7288d2afbd9cbfa114928cce8bb4625c`. The requested `m2-retail-discovery` tag was absent after fetching tags; current `main` still describes the Target-only Milestones 0–1 baseline.

## Files and ownership

- `src/adapters/crowd/reddit/**`
- `src/features/sightings/parser/**`
- `src/features/sightings/dedup/**`
- `src/features/sightings/location/**`
- `tests/fixtures/crowd/**`
- `tests/crowd/**`
- `docs/CROWD_INTELLIGENCE.md`
- `docs/coordination/feature-crowd-intelligence.md`

## Migrations and configuration

Migrations: none. Existing `crowd_posts`, `sightings`, and `sighting_product_candidates` tables are consumed unchanged. No `AvailabilityObservation` is created for Ross or any crowd report.

Owned code accepts fixture, unavailable, and OAuth modes. Live mode needs a lead-owned environment extension that defaults to unavailable and requires explicit live enablement, approved Reddit credentials/token handling, request timeout, page bound, minimum request interval, response-size limit, configured communities, and term/location sets. No shared env file was changed because configuration ownership belongs to the lead.

## Minimal lead-owned contract requests

1. Add the exact `CrowdSourceAdapter`, `CrowdQuery`, and canonical raw crowd-post Zod/type contracts to `src/domain/adapters.ts`; this branch currently keeps compatible types adapter-local because only `RetailDiscoveryAdapter` exists.
2. Add shared crowd repository/orchestration interfaces for ingestion-run lifecycle and durable checkpoint commit. This branch keeps `CrowdSightingRepository` inside the owned parser path and consumes the Drizzle schema directly.
3. Wire Reddit env validation and registry/scheduler extension points. Production default must be unavailable unless `LIVE_INGESTION_ENABLED=true` and approved OAuth access is fully configured.
4. Expose canonical curated aliases through a read-only matching/query interface. The current schema/repository surface exposes names and identifiers but no alias records; alias candidates therefore use configured terms plus canonical names and remain unconfirmed.
5. Decide whether to seed/map public Ross store records. The current seed has a Ross retailer but only Target stores, so a named Ross report can be `NAMED_STORE` while `storeId` remains null.
6. Restore or create the missing `m2-retail-discovery` integration tag before lead integration so this branch can be reviewed against the intended milestone sequence.

## Fixture coverage

Synthetic fixtures cover all four communities, exact local Ross photo/UPC, Louisville regional Ross activity, explicit national Ross activity, unknown location, crosspost, stale report, conflicting identifiers, deleted post, malformed payload, throttling metadata, and duplicate replay. No fixture contains production content, credentials, private addresses, or copied user identity.

## Tests

Focused proof-first tests were added for adapter success/unavailable/throttled/aborted/malformed modes, checkpoint and pagination bounds, OAuth request controls, sanitization, Ross scopes, stale evidence, configurable bounded terms, identifier conflicts, conservative aliases, dedup groups, and PostgreSQL replay.

- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm test -- --run tests/crowd`: 4 files passed / 13 tests passed; PostgreSQL file skipped because `TEST_DATABASE_URL` was not configured.
- `npm test`: 11 files passed / 30 tests passed; 1 PostgreSQL crowd test file skipped.
- `npm run test:integration`: 1 file / 2 tests skipped because `TEST_DATABASE_URL` was not configured.
- `npm run build`: passed; Next.js production routes compiled and generated successfully.

No test contacted Reddit or another live third-party service. The PostgreSQL integration case is committed and will execute when CI supplies its disposable `TEST_DATABASE_URL`.

## Known limitations

- Public text can omit or misstate store, product, and time; unknown/ambiguous mappings require review.
- A media URL is metadata only; no pixels, OCR, or image classification are used.
- Near-duplicate token similarity can miss heavily rewritten reposts or group short, formulaic reports.
- Exact identifier parsing depends on explicit configured labels; unlabeled numbers are intentionally ignored to reduce false positives.
- Reddit newest-feed polling is bounded and can miss posts during long outages or volumes beyond the configured page window.
- OAuth token acquisition/refresh and scheduler checkpoint transactionality require the lead-owned integration points listed above.

## Commit

Implementation commit: `811ba4228f37c001c9832531df9e43c4603c16d9`. Branch: `feature/crowd-intelligence`. The final branch tip also includes the coordination-note handoff commit that records this SHA.
