# Hunt Experience specialist handoff

## Summary

The branch implements polished mobile-first Discover, Hunts, Signals, and Product Detail surfaces. It preserves the existing ranking vocabulary and weights, treats retailer/crowd evidence as signals rather than inventory promises, and keeps cached evidence visible when a source is unavailable.

## Ownership and baseline note

The m3-crowd-intelligence baseline stores the four pages at src/app/discover, src/app/hunts, src/app/signals, and src/app/products rather than under the route group named in docs/BUILD_PLAN.md. Those existing files are the only routable equivalents of the four owned app surfaces; adding parallel (app) pages would create duplicate Next.js routes. This branch edits those four legacy surface paths and no other app routes.

## Presentation-only fixture behavior

src/features/presentation/hunt-experience.ts is a typed presentation adapter. Fixture-only behavior is intentionally limited to:

- additional retailer chips/listings not present in the singular ProductView.listing;
- deterministic store-lead inputs passed through the existing rankStore service;
- chronological availability, crowd, Ross-scope, and source-health signal records;
- sanitized crowd excerpts, a manually curated related-wave item, and match-review copy.

The UI labels degraded data as cached fixture evidence. None of this adapter writes canonical data, changes matching, or bypasses lead-owned services.

## Minimal typed query requests for lead integration

The lead can replace the presentation fixture adapter with three read-only queries:

1. listHuntExperienceProducts(userId): Promise<HuntProductView[]>
   - canonical product/identifiers/user state;
   - all retailer listings and latest append-only observations;
   - existing ordered ranking snapshots with label, calculated time, rules version, and full factor list;
   - store name/profile preference and exact-versus-wave crowd evidence.
2. listSignalFeed(filters, cursor): Promise<SignalFeedPage>
   - chronological discovery, availability-change, sighting, Ross crowd-inventory, and ingestion/source-health records;
   - product, retailer, freshness, source availability, and canonical location scope;
   - sanitized excerpt plus allowlisted external permalink.
3. getProductEvidenceDetail(productId, userId): Promise<ProductEvidenceDetail | null>
   - canonical product and identifiers;
   - all listings, availability history, sightings, curated wave memberships, and match-review/duplicate state.

These queries should return ISO UTC timestamps and existing ranking/location enums. Presentation remains responsible for Indianapolis localization and the fixed Ross labels.

## Files changed

- Four legacy app-surface page/loading/error directories.
- src/components/discover/**
- src/components/hunts/**
- src/components/signals/**
- owned product components and shared CSS module under src/components/products/**
- src/features/presentation/**
- tests/ui/** and tests/e2e/critical.spec.ts
- docs/UX.md
- this coordination note

No schema, migrations, adapters, ingestion, matching, ranking weights, auth, environment, scheduler, or global shell files changed.

## Migrations and configuration

None.

## Tests

- npm run lint — passed, zero warnings.
- npm run typecheck — passed.
- npm test — 19 files passed / 1 skipped; 78 tests passed / 2 skipped.
- npm run test:integration — repository environment skip: 1 file and 2 PostgreSQL tests skipped because TEST_DATABASE_URL was not configured.
- npm run test:e2e — 10/10 passed across mobile-chromium (390 × 844) and desktop-chromium, including axe and keyboard-focus checks.
- npm run build — passed; all four experience routes compiled as dynamic server routes.
- In-app browser — page identity, nonblank render, framework-overlay absence, console health, interaction loop, mobile/desktop screenshots, horizontal overflow, external-link rel attributes, and sanitized excerpt checks passed.

The first Playwright accessibility run found invalid description-list nesting around copy buttons. Identifiers now use a semantic list; the complete two-project rerun passed with zero serious or critical axe violations.

## Known limitations

- Multi-retailer, signal, source-health, sighting, and curated-wave content is fixture-only until the typed queries above are wired.
- The existing app shell caps desktop reading width at 760 pixels; this branch preserves that lead-owned layout.
- Ross named-local fixture text does not map to a seeded Ross Store; the UI says “near 116th · Fishers” and “crowd report only” rather than inventing a formal store record.

## Commit

Implementation commit SHA will be added after validation. Branch: feature/hunt-experience.
