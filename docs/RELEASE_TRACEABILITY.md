# MVP release traceability

Status: release-candidate checklist for `release/mvp` after `m4-hunt-experience`. “Verified” means code and deterministic tests exist; final command/deployment evidence is recorded in the release coordination note.

## Included requirements

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Fresh clone, exact lockfile, strict TypeScript, CI | `package-lock.json`, `tsconfig.json`, `.github/workflows/ci.yml` | clean-clone release check; `npm run lint`, `npm run typecheck`, `npm test`, integration, Playwright, build |
| PostgreSQL schema for every documented entity | `src/db/schema.ts`, additive migrations under `drizzle/` | `tests/integration/postgres.test.ts`, `tests/crowd/postgres.integration.test.ts`, fresh migration/seed |
| Central-Indiana stores without a home address | `scripts/seed.ts` | seed inspection and PostgreSQL integration setup |
| Canonical Zod boundaries and structured adapter results | `src/domain/adapters.ts`, source parsers | Target and retail adapter contract suites; Reddit contract suite; malformed/timeout/size tests |
| Honest Target/Walmart/Meijer/NECA/online/Reddit modes | registries and `src/features/sources/status.ts` | `tests/unit/source-health.test.ts`, adapter contract tests |
| No live network in CI | fixture registries and CI environment | CI workflow inspection; all fixture/contract tests use local payloads or injected providers |
| Idempotent ingestion and run tracking | ingestion orchestration, repositories, unique keys | duplicate replay tests, PostgreSQL replay tests, fixture-demo commands |
| Atomic persistence and non-overlapping jobs | repository transactions and PostgreSQL advisory leases | ingestion unit rollback spy; PostgreSQL transaction and advisory-lock integration tests |
| Exact identifiers first; title-only never auto-merges; conflicts reviewed | `src/matching/match-product.ts`, `match_review_items` | matching unit tests and retail duplicate/review tests |
| Cross-retailer UPC/GTIN canonicalization and namespaced retailer IDs | identifier domain and repositories | identifier, matching, retail replay, PostgreSQL integration tests |
| New/Hunt/Watch/Ignore/Own classification with idempotent mutations | classification component, route, state/history tables | unit/integration mutation tests and Playwright critical path |
| Append-only availability with provenance/freshness | observations table, catalog projections, Product Detail/Hunts | integration replay tests, presentation tests, Playwright detail assertions |
| Source unavailable differs from out of stock; cached rows survive | source matrix, catalog/signal queries, degraded banners | source-health tests, cached PostgreSQL projection test, Playwright degraded state |
| Reddit/Ross sanitization, scopes, checkpoints, deduplication and reviewable candidates | crowd adapter, parsing/dedup/persistence modules | crowd unit/contract/PostgreSQL suites and Signals Playwright path |
| Ross remains crowd-inventory and never formal availability | retailer kind and crowd persistence boundary | crowd PostgreSQL test asserts zero availability rows |
| Transparent deterministic ranking with exact evidence stronger than line/wave evidence | `src/ranking`, Hunts query/UI | ranking unit tests, combined seven-source fixture test, stable tie test |
| No probability claim and every lead exposes factors or insufficient evidence | ranking result and Hunts UI | ranking/UI fixture tests and Playwright Hunts assertions |
| Discover, Hunts, Signals, Product Detail, Status | App Router pages and view queries | mobile/desktop Playwright critical and preview smoke suites |
| Keyboard, focus, touch, reflow and screen-reader basics | semantic UI, skip link, CSS focus/touch rules | axe, keyboard, 320px reflow, 390px and desktop Playwright projects |
| Owner authentication, authenticated jobs and same-origin mutations | `proxy.ts`, `src/security/owner-auth.ts`, API routes | owner-auth/env tests; route behavior in build/browser validation |
| SSRF/redirect/timeout/size/untrusted-content controls | public URL validation, retailer host allowlists, redirect rejection, bounded provider clients, sanitizer | adapter, URL, OAuth redirect and sanitization tests |
| Owner-visible source health, current run, counts and last success | Status page and source-run projection | source-run unit test and Status browser/axe check |
| Raw-source retention and source takedown behavior | retention service and authenticated job route | deterministic cutoff unit test and crowd PostgreSQL redaction test |
| Production-safe variables/schedules, backup/restore and rollback | `.env.example`, `ops/`, deployment/runbook docs | release operations validation and recorded drill results |

## Explicit exclusions and absence checks

Checks search production paths (`src`, `scripts`, `ops`, migrations) and review dependencies/routes. Documentation may name exclusions to state policy.

| Explicit exclusion | Absence check |
| --- | --- |
| Route optimization or driving directions | no map/directions/geocoding dependency, route, or service; search `route.?optim|driving.?direction|google.?maps|mapbox` |
| Beyond-TMNT expansion | database check fixes `franchise = 'TMNT'`; search for alternate franchise seeds/catalog modes |
| Native mobile apps | no iOS/Android/React Native/Expo project or dependency |
| Private Facebook automation | no Facebook adapter, cookie/session storage, browser automation, or private-group ingestion |
| Discord bots/servers | no Discord dependency, webhook, bot route, or adapter |
| Complex ML, opaque ranking, predictive percentages | no model/embedding dependency or inference service; tests reject percent/probability vocabulary |
| Valuation/resale/marketplace | no valuation, checkout, listing-sale, or marketplace module/dependency |
| Social posting | no outbound post/publish mutation to social networks |
| Broad image/package recognition | provider images are not fetched server-side; no OCR/vision dependency or pipeline |
| Multi-user community features | one allowlisted owner; no signup, public profile, follow, comment, or tenant routes |
| Automated wave detection | wave tables are structural only; no wave ingestion, detector, inference, alert, or ranking input. `LINE_OR_WAVE_*` is explicitly weaker crowd evidence, not wave detection |

Release absence command:

```bash
rg -n -i 'route.?optim|driving.?direction|mapbox|facebook|discord|tensorflow|pytorch|embedding|valuation|marketplace|social.?post|ocr|computer.?vision|wave.?detect|wave.?infer' src scripts ops drizzle
```

Any match must be explained in the release coordination note; unexplained production capability is blocking.
