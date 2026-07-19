## Code Review Results

**Scope:** `m4-hunt-experience` -> working tree (84 files, 1,175 additions / 165 deletions)
**Intent:** Harden and validate the Shelf Radar MVP release candidate
**Mode:** markdown local-apply

**Reviewers:** correctness, standards, testing, maintainability, security, performance, api-contract, reliability, adversarial
- Security and API-contract review covered the new authentication and job endpoints.
- Reliability and performance review covered scheduled ingestion, retention, and database health projections.

### Applied (explicit local apply; safe, verified)

| # | File | Fix | Reviewer |
|---|---|---|---|
| 1 | `proxy.ts:16` (+test) | Removed Product Detail from the authentication matcher bypass | security, correctness |
| 2 | `src/adapters/crowd/reddit/oauth-client.ts:54` (+test) | Replaced unbounded body materialization with a cancelling bounded stream reader | security, performance, reliability |
| 3 | `src/ingestion/run-discovery.ts:58` (+test) | Reset create/update counters when the persistence transaction rolls back | correctness, API contract |
| 4 | `src/domain/adapters.ts:11` (+test) | Limited IPv6 private-prefix checks to actual IPv6 hosts | correctness |
| 5 | `src/operations/postgres-lease.ts:9` | Added connection/query time bounds and cleanup even when reserve or unlock fails | reliability, security |
| 6 | `src/features/sources/queries.ts:43` | Replaced full ingestion-history reads with distinct latest/latest-successful queries | performance, maintainability |
| 7 | `src/operations/retention.ts:16` (+test) | Avoided rewriting already-redacted crowd records on every retention run | performance, correctness |

Validation: lint passed; typecheck passed; 28 unit files / 108 tests passed; production build passed; the full dependency audit found 0 vulnerabilities after exact transitive overrides. PostgreSQL integration passed 2 files / 8 tests before the final query-only hardening; the PR CI rerun remains required.

Commit status: left uncommitted because the release working tree was already dirty before review.

### Learnings & Past Solutions

- Existing repository contracts consistently separate unavailable from out-of-stock and require external payloads to remain bounded and reviewable; fixes preserved those patterns.

### Deployment Notes

- Deploy the preview with fixture data, no database, no provider credentials, and global live ingestion disabled.
- Keep all production source modes unavailable until an approved connector is composed and reviewed.
- Verify the PostgreSQL retention and source-health queries against CI PostgreSQL before release approval.

### Coverage

- Suppressed: static accessibility scanner component-level landmark findings were false positives because the root layout owns the single skip link and main landmark; wrapped labels and `role=alert` provide the names/live semantics it also flagged.
- Residual risks: DNS rebinding is an approved-connector/egress concern; edge rate limiting and TLS are hosting controls; no live connector ships.
- Testing gaps: local Chromium could not launch because MachPort bootstrap was denied; preview smoke and axe must execute in CI/hosting.
- Failed reviewers: cross-model review and subagent dispatch were unavailable under the active no-subagent/tool-limit constraints; inline adversarial review was completed.

---

> **Verdict:** Ready for CI with applied fixes
>
> **Reasoning:** No open P0-P2 code findings remain. Database and browser checks that the local host cannot execute must be proven by PR CI before release authorization.
>
> **Fix order:** PR CI PostgreSQL -> Playwright/axe -> fixture preview smoke -> release authorization
