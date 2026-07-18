# Phased Build Plan, Branches, and Ownership

## Integration strategy

One lead task owns architecture and `main`. Specialists begin only after the preceding milestone is merged and tagged. Work is sequential to minimize schema drift:

1. Lead foundation and Target vertical slice.
2. Retail Discovery specialist.
3. Lead review and integration.
4. Crowd Intelligence specialist, including Ross Finds.
5. Lead review and integration.
6. Hunt Experience specialist.
7. Lead review, full-system hardening, and release candidate.
8. Wave detector later on a separate milestone.

## Milestone 0 — Repository foundation

Lead branch: `feature/lead-target-vertical`

Deliver:

- GitHub repository and protected `main`.
- Root `AGENTS.md` and documentation from this package.
- Next.js/TypeScript app, PostgreSQL/Drizzle, Zod, Vitest, Playwright, lint/typecheck/build scripts.
- Environment validation and safe feature flags.
- Core schema and migrations.
- Seed data for local retailers/stores and a development user.
- Adapter contracts, fake adapters, ingestion run tracking, and canonical matching.
- CI using fixtures only.

Gate: clean install, migration, seed, lint, typecheck, unit tests, and build all pass.

## Milestone 1 — Target vertical slice

Still on `feature/lead-target-vertical`.

End-to-end path:

```text
Target fixture/provider result
  -> validate
  -> normalize product/listing/identifiers
  -> idempotent persistence
  -> Discover UI
  -> Hunt/Watch/Ignore/Own
  -> product detail
  -> availability observation and freshness
```

The live Target connector may use an approved provider if credentials exist. Otherwise ship a production-safe `unavailable` connector plus realistic fixtures. Do not fake live support.

Gate: Target slice acceptance tests pass; lead opens PR, reviews it, merges to `main`, and tags `m1-target-slice`.

## Milestone 2 — Retail Discovery specialist

Branch/worktree: `feature/retail-discovery` / `../shelf-radar-retail`

Owns:

- `src/adapters/retail/walmart/**`
- `src/adapters/retail/meijer/**`
- `src/adapters/retail/neca/**`
- `src/adapters/retail/online/**`
- adapter-local fixtures under `tests/fixtures/retail/**`
- adapter tests under `tests/retail/**`
- `docs/RETAIL_SOURCES.md`
- `docs/coordination/feature-retail-discovery.md`

May add exports in a retailer adapter registry file only if the lead created an explicit extension point.

Must not change:

- database schema/migrations;
- canonical domain types or shared adapter interfaces;
- matching/ranking services;
- UI beyond a minimal adapter status label if an existing extension point exists;
- Target adapter.

Deliver provider-neutral live connectors or explicit unavailable stubs, parsers, fixtures, capability declarations, rate-limit behavior, and normalized identifiers for Walmart item IDs, Meijer SKUs, UPC/GTIN, NECA/online SKUs.

Gate: specialist tests and full suite pass; lead integrates and tags `m2-retail-discovery`.

## Milestone 3 — Crowd Intelligence specialist

Branch/worktree: `feature/crowd-intelligence` / `../shelf-radar-crowd`

Owns:

- `src/adapters/crowd/**`
- `src/features/sightings/parser/**`
- `src/features/sightings/dedup/**`
- `src/features/sightings/location/**`
- crowd fixtures under `tests/fixtures/crowd/**`
- tests under `tests/crowd/**`
- `docs/CROWD_INTELLIGENCE.md`
- `docs/coordination/feature-crowd-intelligence.md`

May consume shared repository methods and matching interfaces. Must not change schema, shared domain types, ranking defaults, retail adapters, or user-facing Hunt UI.

Deliver:

- OAuth/config-aware Reddit adapter or explicit unavailable mode.
- Configured communities: TMNT, NECATMNT, ActionFigures, RossFinds.
- Query term sets and checkpointed incremental fetch.
- Location scopes: named store, local city, regional, national, unknown.
- Ross crowd-inventory classification and signal extraction.
- Exact product, line/wave, retailer, time, and evidence parsing.
- Cross-post/repost deduplication that preserves provenance.
- Structured sightings and review candidates.

Gate: no live network in CI; replay fixtures cover all communities and Ross scopes; lead integrates and tags `m3-crowd-intelligence`.

## Milestone 4 — Hunt Experience specialist

Branch/worktree: `feature/hunt-experience` / `../shelf-radar-hunt`

Owns:

- `src/app/(app)/discover/**`
- `src/app/(app)/hunts/**`
- `src/app/(app)/signals/**`
- `src/app/(app)/products/**`
- `src/components/discover/**`
- `src/components/hunts/**`
- `src/components/signals/**`
- `src/components/products/**`
- presentation-only helpers under `src/features/presentation/**`
- UI tests under `tests/ui/**` and relevant Playwright specs
- `docs/UX.md`
- `docs/coordination/feature-hunt-experience.md`

Must not change schema/migrations, ingestion, adapters, canonical matching, ranking weights, or auth architecture. If a query shape is missing, request it in the coordination note and use a typed view-model boundary that the lead can wire.

Deliver mobile-first Discover, Hunts, Signals, and Product Detail surfaces; accessible state actions; retailer/source freshness; transparent ranking factor display; empty/loading/error/stale states; Ross scope labels; and responsive browser tests.

Gate: 390px-wide critical flows pass Playwright, accessibility basics pass, full suite passes; lead integrates and tags `m4-hunt-experience`.

## Milestone 5 — Lead hardening and release candidate

Lead on `main` or `release/mvp`:

- Wire specialist extension points.
- Resolve only documented contract gaps.
- Add ranking service and versioned factor tests if not already complete.
- Add source health/admin view.
- Test degraded operation when every external source is unavailable independently.
- Threat-model job endpoints and untrusted content.
- Verify seed, migrations, deployment, scheduled jobs, backup, logs, and rollback.
- Run full acceptance suite and create `v0.1.0` release candidate.

## Later milestone — Wave detector

Start only after real data has produced a stable canonical catalog and false-merge rate is acceptable. Use `feature/wave-detector`. Initially support curated wave memberships and rules-based activity propagation with visibly weaker evidence. Do not introduce ML.

## Worktree commands

Run from the parent directory of the repository. Replace paths if the repository lives elsewhere.

```bash
git clone <GITHUB_REPOSITORY_URL> shelf-radar
cd shelf-radar
git switch main

git switch -c feature/lead-target-vertical
# Lead works here. After PR review and merge, return to main:
git switch main
git pull --ff-only

git worktree add ../shelf-radar-retail -b feature/retail-discovery main
# After merge and worktree task completion:
git worktree remove ../shelf-radar-retail
git branch -d feature/retail-discovery

git pull --ff-only
git worktree add ../shelf-radar-crowd -b feature/crowd-intelligence main
# After merge:
git worktree remove ../shelf-radar-crowd
git branch -d feature/crowd-intelligence

git pull --ff-only
git worktree add ../shelf-radar-hunt -b feature/hunt-experience main
# After merge:
git worktree remove ../shelf-radar-hunt
git branch -d feature/hunt-experience
```

Do not remove a worktree until its branch is pushed, its PR is merged, and its task has provided a final handoff. Confirm with `git worktree list` and `git status` first.

## GitHub controls

- Protect `main`; require PR, green CI, and no unresolved review comments.
- Disable force-push and branch deletion on `main`.
- Use CODEOWNERS if multiple humans join later; for now the lead is the reviewer.
- PR template requires scope, screenshots for UI, migration/config notes, tests, source-access limitations, and rollback.
- Use squash merge for a tidy MVP history unless preserving specialist commits materially aids review.
