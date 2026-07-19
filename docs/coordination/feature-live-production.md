# Live production coordination

## Outcome

In progress: convert the read-only fixture release candidate into a persistent single-user production application with two reviewed live sources. The official NECA Store connector supplies real TMNT product discovery, price, SKU, image, preorder, online-available, and sold-out observations. The Reddit RSS connector supplies current public posts from TMNT, NECATMNT, ActionFigures, and RossFinds as sanitized, timestamped crowd evidence. Target, Walmart, Meijer, and BigBadToyStore remain unavailable.

## Access and compliance

- NECA documents `/collections/{handle}/products.json` in its public `agents.md` as unauthenticated read-only browsing. Shelf Radar uses only the fixed TMNT collection endpoint; no cart or checkout operation exists.
- Reddit's public robots policy allows `/r/*.rss`. Shelf Radar uses one fixed-host combined subreddit feed request, not search RSS, comments RSS, JSON, API, logged-in access, or scraping.
- Both transports reject redirects, enforce fixed hosts, timeouts, response-size limits, bounded inputs, structured throttling, and Zod-validated normalization. Reddit XML declarations/entities are rejected and excerpts/authors are sanitized/hashed before persistence.

## Environment and schedules

- `NECA_ADAPTER_MODE=public` and `REDDIT_ADAPTER_MODE=rss` require `LIVE_INGESTION_ENABLED=true`.
- Production uses database mode, fixtures off, strong owner/job secrets, and all other sources unavailable.
- Vercel schedules Reddit and retention once daily. GitHub Actions schedules NECA once daily because the storefront returns `503` from Vercel egress; both paths use the canonical services and PostgreSQL leases.
- Managed Neon PostgreSQL is provisioned, migrated, seeded, and connected to Vercel. Strong owner/job secrets are stored in Vercel and the macOS login Keychain; no secret or production payload is committed.

## Verification so far

- Proof-first focused suite: 6 files / 24 tests passed after observing the expected missing-mode/module/auth failures.
- Strict TypeScript passed.
- Read-only live NECA smoke: 150 real products returned; sample current 2012 Cartoon Splinter, Casey Jones, and Metalhead preorders normalized at USD 37.99.
- Read-only live Reddit smoke: 12 current relevant public posts returned in one combined request.
- Persistent Neon ingestion: 149 products, 150 retailer listings, 150 append-only availability observations, 12 crowd posts, 11 sightings, and 46 conservative candidates.
- Production authentication: unauthenticated `401`, authenticated `200`.
- Production Playwright: 6/6 mobile/desktop checks passed, including durable classification and axe serious/critical scanning.
- Vercel job smoke: Reddit succeeded; NECA correctly produced a structured `SKIPPED` result on upstream `503`, motivating the GitHub worker fallback.
- Fresh disposable PostgreSQL: migrations and seed succeeded; 2 files / 8 integration tests passed.
- Local critical Playwright: 14 passed / 16 production-or-preview-specific checks skipped as designed.
- Backup/restore drill: a production custom-format dump listed 180 entries and restored 149 products plus 4 ingestion runs into a disposable local database; the restored database and temporary production payload were removed afterward.
- Final lint, strict TypeScript, 30 files / 115 unit and contract tests, production build, and `npm audit`: passed; 0 vulnerabilities.

## Git

- Branch: `feature/live-production`
- Commit SHA: pending cohesive implementation commit.
