# Shelf Radar

Shelf Radar is a mobile-first, single-user TMNT discovery and sourcing web app. The repository now includes reviewed live connectors for the official NECA Store catalog and public Reddit subreddit RSS, alongside fixture-backed Target/retail contracts, Reddit/Ross crowd intelligence, transparent Hunts ranking, and production-safe operational boundaries.

The app is deliberately careful with retailer data. Availability is stored as an append-only observation with a source and timestamp. It is not an inventory promise, and `SOURCE_UNAVAILABLE` is never rendered as out of stock.

## What works

- Target fixture discovery, canonical validation, normalization, exact-identifier matching, PostgreSQL persistence, and idempotent replay.
- Fixture/unavailable/provider boundaries for Walmart, Meijer, NECA, and an allowlisted online source, including exact cross-retailer UPC merging.
- Fixture/unavailable/OAuth-boundary Reddit ingestion for TMNT, NECATMNT, ActionFigures, and RossFinds with sanitized excerpts, durable checkpoints, conservative product candidates, and provenance-preserving deduplication.
- Integrated Discover, one-tap classification (`New`, `Hunt`, `Watch`, `Ignore`, `Own`), Product Detail, transparent Hunts leads, filterable crowd Signals, and owner source status.
- Target identifiers remain namespaced; title-only candidates never auto-merge; exact-identifier conflicts enter `match_review_items`.
- Versioned ranking vocabulary with visible positive, negative, and neutral factors. No probability percentages.
- Ross crowd reports remain distinct from retailer inventory observations, with named-store, local, regional, national, and unknown scopes shown explicitly.
- Full schema support for curated waves and later review workflows without claiming those capabilities are active.
- Authenticated, non-overlapping scheduled-job routes, persisted source run health/counts, cached-data degradation, and raw-source retention.
- Fixture preview support plus production owner authentication and live-ingestion kill switches.

Two live read-only connectors are shipped and remain disabled unless database mode and the global live-ingestion flag are explicitly enabled: the official NECA Store collection JSON documented by the store for unauthenticated agent browsing, and Reddit's robots-allowed public subreddit RSS. Target, Walmart, Meijer, and BigBadToyStore provider modes remain extension points only. Reddit OAuth mode still requires approved credentials and an injected approved-access client. Ross remains crowd-inventory only and never creates formal availability observations.

Owner production app: [shelf-radar.vercel.app](https://shelf-radar.vercel.app). It is backed by managed PostgreSQL, requires the configured owner login, and displays persisted records from the live sources in the matrix below. Preview/local fixture mode remains synthetic and network-free.

| Source | v0.1.0 production | Preview/local |
| --- | --- | --- |
| Target, Walmart, Meijer, BigBadToyStore | Unavailable; no connector shipped | Fixture-only |
| NECA Store | Live official online catalog (`public`) | Fixture-only |
| Reddit / Ross Finds | Live public subreddit feed (`rss`); OAuth remains optional | Fixture-only |

## Requirements

- Node.js 20.19 or newer
- npm 11 (the committed `package-lock.json` is authoritative)
- PostgreSQL 15 or newer for migration, seed, and integration tests

## Install and run

```bash
npm ci
cp .env.example .env.local
npm run demo:web
```

Open `http://localhost:3000/discover`. Fixture web mode does not need a database or third-party network access.

To exercise the ingestion pipeline without the UI:

```bash
npm run demo:fixtures
```

The command ingests the Target fixture twice and prints counts proving that products, listings, and availability observations are not duplicated.

To replay every registered retail fixture and verify exact cross-retailer UPC merging:

```bash
npm run demo:retail-fixtures
```

## PostgreSQL migration and seed

Create an empty database, set `DATABASE_URL` (and optionally `DATABASE_DIRECT_URL` for migrations), then run:

```bash
npm run db:migrate
npm run db:seed
```

The seed creates a development owner, six retailer records, and Target stores in Fishers, Carmel, Westfield, Castleton, and Noblesville. It stores city/region summaries only—never a home address.

For the PostgreSQL integration suite, set `TEST_DATABASE_URL` to a disposable database that can be truncated:

```bash
TEST_DATABASE_URL=postgresql://... npm run test:integration
```

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run test:preview # requires PREVIEW_BASE_URL
npm run build
```

CI provisions disposable PostgreSQL and Chromium. No test or build contacts Target or another retail/crowd source.

## Repository shape

- `src/domain`: canonical Zod schemas, identifiers, adapter contracts
- `src/db`: Drizzle schema, client, and catalog repositories
- `src/adapters/retail`: Target, Walmart, Meijer, NECA, and allowlisted-online fixture/unavailable/provider boundaries
- `src/adapters/crowd`: Reddit fixture/unavailable/OAuth boundary
- `src/ingestion`: orchestration, run records, idempotency
- `src/matching`: exact-identifier-first matching policy
- `src/ranking`: versioned, transparent ordinal factors
- `src/features`: use cases and view-model boundaries
- `src/app` / `src/components`: App Router UI and mutation route
- `drizzle`: committed SQL migrations
- `tests`: unit, adapter, PostgreSQL, fixture, and Playwright coverage

See [Product Brief](docs/PRODUCT_BRIEF.md), [Architecture](docs/ARCHITECTURE.md), [Release Traceability](docs/RELEASE_TRACEABILITY.md), [Operations Runbook](docs/OPERATIONS_RUNBOOK.md), [Security Review](docs/SECURITY_REVIEW.md), [UX states](docs/UX.md), [Acceptance Tests](docs/ACCEPTANCE_AND_TESTS.md), [Source Compliance](docs/SOURCE_COMPLIANCE.md), [Deployment](docs/DEPLOYMENT.md), and [Changelog](CHANGELOG.md).

## Safety

- Keep live ingestion disabled until an approved connector, explicit flag, and credentials exist.
- Never commit `.env`, production payloads, tokens, cookies, addresses, or browser artifacts.
- Treat external payloads as untrusted data and validate with Zod before normalization.
- Disable live ingestion globally with `LIVE_INGESTION_ENABLED=false`; set each source mode to `unavailable` when it should not serve fixtures.

## Release and operations status

Production runs in database mode with owner/job secrets and fixtures off. `NECA_ADAPTER_MODE=public` and `REDDIT_ADAPTER_MODE=rss` are enabled with the global live-ingestion flag. A daily GitHub Actions worker refreshes NECA because the official storefront currently rejects Vercel-datacenter requests; Vercel Cron refreshes Reddit and retention daily. Target, Walmart, Meijer, and BigBadToyStore remain unavailable. Backup/restore, schedule, retention, source-enable and additive rollback procedures are in the operations runbook.

The release branch may be merged and tagged `v0.1.0` only after explicit authorization and green required CI. Automated wave detection remains excluded.
