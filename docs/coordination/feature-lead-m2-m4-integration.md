# Lead integration handoff — Target through Hunt

## Outcome

Reverified the Target milestone gate, merged and normalized the retail and crowd specialist branches, and implemented the missing Hunt experience directly because no local or remote `feature/hunt-experience` branch existed after authenticated fetches. Discover, Hunts, Signals, Product Detail, and Source Status now exercise one integrated fixture dataset with truthful availability, source-health, matching, crowd-scope, and ranking language.

## Integration decisions

- Accepted optional `fetchListing`, adapter parser-version metadata, canonical crowd contracts, durable ingestion checkpoints, and existing ranking-factor mapping.
- Kept Ross as crowd-inventory evidence. No Ross Store or AvailabilityObservation record is inferred from public text.
- Kept aliases read-only/future-facing and rejected title-only auto-merge.
- Labeled synthetic Hunt and Signals behavior explicitly; database mode does not inject fixture crowd evidence.
- Hardened Target's provider extension with shared pagination, payload-size, abort, and timeout policy.
- Closed ingestion runs on unexpected adapter/persistence failures without exposing provider error details.
- Made classification mutation IDs durable and idempotent across intervening state changes under a PostgreSQL row lock.

## Files

- Integrated retail/crowd adapters, orchestration, repositories, domain contracts, fixtures, tests, and documentation from milestone commits.
- Added Hunt and Signals view models under `src/features/hunts` and `src/features/signals`.
- Completed Discover, Hunts, Signals, Product Detail, Source Status, loading, error, responsive, and accessible UI under `src/app` and `src/components`.
- Added `docs/UX.md` and updated README, deployment, and source-compliance documentation.
- Added unit, adapter, PostgreSQL, UI-view-model, and mobile/desktop Playwright regressions.

## Migrations and environment

No migration was added after the Target foundation migration. The existing migration remains authoritative and was reapplied successfully. Seed verification produced 6 retailers, 5 central-Indiana Target stores, and the local owner without a home address.

Retail source modes and Reddit OAuth configuration were added to the existing validated environment contract. Live ingestion still requires the global flag, a source-specific provider/OAuth mode, approved credentials, and an injected approved connector. No secrets or live payloads were committed.

## Final verification

- `npm run lint`: passed, zero warnings.
- `npm run typecheck`: passed.
- `TEST_DATABASE_URL=postgresql://127.0.0.1:5432/shelf_radar_review npm test`: 20 files passed, 83 tests passed.
- `TEST_DATABASE_URL=postgresql://127.0.0.1:5432/shelf_radar_review npm run test:integration`: 1 file passed, 3 tests passed.
- `npm run test:e2e`: 12 tests passed across 390x844 mobile Chromium and desktop Chromium; axe found zero serious/critical violations on Discover, Hunts, Signals, Status, and Product Detail.
- `npm run build`: passed with Next.js 16.2.10.
- `npm run demo:fixtures`: passed; replay retained 3 products, 3 listings, and 4 observations.
- `npm run demo:retail-fixtures`: passed; 10 listings normalized to 8 products and shared UPC `634482541333` resolved to one canonical product.
- `npm run db:migrate` and `npm run db:seed`: passed against the disposable local review database.
- `npm audit --omit=dev --audit-level=high`: passed the high-severity gate; npm reports 2 moderate PostCSS advisories inherited through the current stable Next.js 16.2.10. The offered forced fix is a breaking downgrade and was not applied.

Manual visual inspection covered mobile and desktop Discover/Signals plus mobile Hunts, Product Detail, and Source Status. It found and fixed identifier collisions, compressed status rows, duplicate crosspost signals, duplicate historical store leads, and insufficient contrast. Keyboard focus order and mutation-failure recovery are covered in Playwright.

## Adapter status and limitations

- Target: fixture-ready; honest unavailable mode; provider extension only; no live connector.
- Walmart: fixture-ready; honest unavailable mode; provider extension only; no live connector.
- Meijer: fixture-ready; honest unavailable mode; provider extension only; no live connector.
- NECA: fixture-ready; honest unavailable mode; provider extension only; no live connector.
- Allowlisted online / BigBadToyStore: fixture-ready; honest unavailable mode; provider extension only; no live connector.
- Reddit / Ross Finds: fixture-ready; honest unavailable mode; OAuth/injected-client boundary only; no live connector.

Public posts can be wrong, stale, incomplete, or ambiguously mapped. Exact-identifier matching is deterministic in normal replay; independently scheduled concurrent first-seen ingestions remain an operational case to serialize when a scheduler is added. No scheduler, production authentication provider, or live-source credentials are included.

## Commits and branch

- Retail integration: `6f1207f` (merge `0df5cb5`), tag `m2-retail-discovery`.
- Crowd integration: `988928d` (merge `d50d83b`), tag `m3-crowd-intelligence`.
- Hunt implementation: `5050ac1449d2e1bcb93f690f420f98e31a362c49`.
- Branch: `feature/lead-m2-m4-integration`.
