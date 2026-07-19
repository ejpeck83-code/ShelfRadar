# Release MVP coordination

## Outcome

Prepared the post-`m4-hunt-experience` MVP release candidate: traceability and exclusion checks, source truth/status, authenticated operations, transactional ingestion, retention, ranking validation, cached degradation, security hardening, release documentation, and fixture-preview coverage. The public fixture profile now labels and disables classification instead of presenting a production write action that cannot persist. Local and database-backed classification remain functional. No live connector and no automated wave detection were added.

## Files

Material release surfaces are listed in `docs/RELEASE_TRACEABILITY.md`; the detailed security and review evidence is in `docs/SECURITY_REVIEW.md` and `docs/reviews/release-mvp/report.md`. Operations are documented in `docs/OPERATIONS_RUNBOOK.md`, `docs/DEPLOYMENT.md`, `.env.example`, and `ops/schedules.production.example.json`.

## Migrations and environment

- No new migration was required; existing migrations remain additive.
- Production now requires database mode, shared-secret owner auth, 32+ character owner/job secrets, fixtures off, global live ingestion off, and all sources unavailable.
- Fresh migration and seed completed against local PostgreSQL 17 before the final query-only hardening: six retailers, five Target stores, and the local owner seed.
- A 54 KB custom-format logical backup was created and `pg_restore --list` verified 123 TOC entries. It restored cleanly into the isolated local `shelf_radar_restore_verify` database; additive migrations reapplied successfully. Source and restore counts matched exactly: 2 products, 0 listings, 0 observations, 9 crowd posts, 1 ingestion run, and 1 migration record.

## Exact validation results

- `npm run lint`: passed, 0 warnings.
- `npm run typecheck`: passed.
- `npm test`: 28 files passed, 109 tests passed.
- `npm run build`: passed with Next.js 16.2.10; 11 application routes built.
- `npm run demo:fixtures`: passed; first run created 3 products, replay created 0 and updated 3; 3 products, 3 listings, 4 append-only observations.
- `npm audit`: passed, 0 vulnerabilities after pinning safe transitive `esbuild` resolutions for Drizzle Kit and Vite.
- GitHub gitleaks initially flagged the synthetic owner secret in `tests/unit/proxy-auth.test.ts`; the exact finding fingerprint is now ignored without excluding the file or generic-secret rule.
- PostgreSQL integration: 2 files / 8 tests passed before the final source-health query and retention no-op refinements. The current sandbox cannot reach the local service; PR CI must rerun the current commit.
- Accessibility static contrast scan: 8/8 detected foreground/background pairs passed WCAG AA normal text. The source scanner reported layout/component false positives; the root layout owns the main landmark/skip link, wrapped labels name both selects, and `role=alert` supplies assertive live semantics.
- Local Playwright: 14/14 executable critical-path mobile/desktop cases passed; 10 remote-preview-only cases skipped as designed.
- PR CI run 8 passed install, audit, migration, seed, lint, typecheck, unit/integration, build, Chromium install, and secret scanning. Its classification critical path exposed a non-production origin mismatch (`localhost` configuration versus Playwright's `127.0.0.1`); the owner-origin check now derives the actual request host outside production while retaining the configured-origin requirement in production.
- PR CI run 9 passed both jobs completely, including gitleaks, fresh migration/seed, 109 unit tests, 8 PostgreSQL integration tests, production build, and 14 Playwright/axe cases; 10 preview-only project cases skipped as designed because CI exercised its managed local server.
- PR CI run 11 passed both jobs completely, including gitleaks, `npm ci`, zero-vulnerability production audit, fresh migration/seed, lint, typecheck, 109 unit tests, 8 PostgreSQL integration tests, production build, and 14 Playwright/axe cases.
- Clean-clone `npm ci`: passed with 404 packages and zero vulnerabilities. Clean-clone lint, typecheck, unit tests, and production build all passed.
- Fixture deployment: `https://shelf-radar.vercel.app`, built by Vercel with fixture defaults, no database, no schedules, no provider credentials, and live ingestion disabled. Vercel assigned the first project deployment its production alias; functionally it remains the public read-only fixture profile.
- Latest fixture deployment: `dpl_5xpSmGi4s9aEuXBgTQGnFGbLufE3`; inspect at `https://vercel.com/emery-pecks-projects/shelf-radar/5xpSmGi4s9aEuXBgTQGnFGbLufE3`.
- Remote preview smoke: 10/10 Playwright cases passed across mobile and desktop for Discover, Hunts, Signals, Status, and Product Detail, including the read-only classification assertions and serious/critical axe checks.

## Source matrix

- Target: fixture-only locally/preview; unavailable in production; no live connector.
- Walmart: fixture-only locally/preview; unavailable in production; no live connector.
- Meijer: fixture-only locally/preview; unavailable in production; no live connector.
- NECA: fixture-only locally/preview; unavailable in production; no live connector.
- BigBadToyStore/online: fixture-only locally/preview; unavailable in production; no live connector.
- Reddit / Ross Finds: fixture-only locally/preview; unavailable in production; OAuth boundary only, no composed live client.

## Known limitations and gates

DNS rebinding and edge rate limiting remain reviewed connector/hosting controls. Basic owner auth has no MFA/session UI. No production source is live. All automated, deployment-smoke, and backup/restore gates are complete; do not merge or tag until the user explicitly authorizes release.

## Git

- Branch: `release/mvp`
- Base: `m4-hunt-experience` plus commit `5049c9568d40e3f7a6ca542a7988b8d10c006597`
- Release implementation commit: `6887eef364a7b8abe3af027010b8b45b0b8efcc1`.
- Dependency/audit follow-up commit: `91e9b988667e5c31ac917306ac2b3805cc9f57fe`.
- Secret-scan false-positive commit: `e57059b31c6e9a84f905c8916270bfb322050ede`.
- Latest pushed release head before the read-only preview follow-up: `d3e3e205ce075150f0e910601f2512e582c86566`.
- Pull request: `https://github.com/ejpeck83-code/ShelfRadar/pull/4` (CI green; mergeable; not merged).
- Merge SHA: pending authorization.
- Release tag: pending authorization (`v0.1.0`).
