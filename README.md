# Shelf Radar

Shelf Radar is a mobile-first, single-user TMNT discovery and sourcing web app. This repository contains the platform foundation plus fixture-backed Target, bounded retail discovery, and Reddit/Ross crowd-intelligence integrations.

The app is deliberately careful with retailer data. Availability is stored as an append-only observation with a source and timestamp. It is not an inventory promise, and `SOURCE_UNAVAILABLE` is never rendered as out of stock.

## What works

- Target fixture discovery, canonical validation, normalization, exact-identifier matching, PostgreSQL persistence, and idempotent replay.
- Fixture/unavailable/provider boundaries for Walmart, Meijer, NECA, and an allowlisted online source, including exact cross-retailer UPC merging.
- Fixture/unavailable/OAuth-boundary Reddit ingestion for TMNT, NECATMNT, ActionFigures, and RossFinds with sanitized excerpts, durable checkpoints, conservative product candidates, and provenance-preserving deduplication.
- Discover, one-tap classification (`New`, `Hunt`, `Watch`, `Ignore`, `Own`), Product Detail, a limited-evidence Hunts lead, Signals empty state, and owner source status.
- Target identifiers remain namespaced; title-only candidates never auto-merge; exact-identifier conflicts enter `match_review_items`.
- Versioned ranking vocabulary with visible positive, negative, and neutral factors. No probability percentages.
- Full schema support for later crowd sightings, Ross crowd-inventory, and curated waves without enabling those capabilities.

No live connector is shipped. Target, Walmart, Meijer, NECA, and online provider modes are extension points only. Reddit OAuth mode additionally requires explicit live enablement, approved credentials, and an injected approved-access client. Ross remains crowd-inventory only and never creates formal availability observations.

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
npm run build
```

CI provisions disposable PostgreSQL and Chromium. No test or build contacts Target or another retail/crowd source.

## Repository shape

- `src/domain`: canonical Zod schemas, identifiers, adapter contracts
- `src/db`: Drizzle schema, client, and catalog repositories
- `src/adapters/retail`: Target fixture/unavailable/provider boundary and unavailable extension stubs
- `src/ingestion`: orchestration, run records, idempotency
- `src/matching`: exact-identifier-first matching policy
- `src/ranking`: versioned, transparent ordinal factors
- `src/features`: use cases and view-model boundaries
- `src/app` / `src/components`: App Router UI and mutation route
- `drizzle`: committed SQL migrations
- `tests`: unit, adapter, PostgreSQL, fixture, and Playwright coverage

See [Product Brief](docs/PRODUCT_BRIEF.md), [Architecture](docs/ARCHITECTURE.md), [Architecture Notes](docs/ARCHITECTURE_NOTES.md), [Acceptance Tests](docs/ACCEPTANCE_AND_TESTS.md), [Source Compliance](docs/SOURCE_COMPLIANCE.md), and [Deployment](docs/DEPLOYMENT.md).

## Safety

- Keep live ingestion disabled until an approved connector, explicit flag, and credentials exist.
- Never commit `.env`, production payloads, tokens, cookies, addresses, or browser artifacts.
- Treat external payloads as untrusted data and validate with Zod before normalization.
- Disable live ingestion by setting `LIVE_INGESTION_ENABLED=false` and `TARGET_ADAPTER_MODE=unavailable`.
