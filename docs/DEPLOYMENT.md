# Deployment Recommendation

## Recommended MVP topology

- GitHub repository with protected `main` and pull-request CI.
- Vercel for the Next.js web application and preview deployments.
- Managed PostgreSQL through Neon or Supabase; choose one and use its pooled serverless connection guidance.
- Vercel Cron or GitHub Actions for scheduled ingestion, calling authenticated internal job endpoints. Keep job logic in application services so scheduling can move later.
- Optional Sentry-compatible error reporting; structured platform logs are sufficient initially.

This is inexpensive, mobile-friendly, and operationally light while preserving a normal PostgreSQL data model. If scheduled runs become longer than platform limits, move only the worker to a small container service; do not redesign the app prematurely.

## Environments

- Local: fixture adapters by default, local PostgreSQL, mock single user.
- Preview: isolated or branched database where practical; fixture ingestion; no production schedules.
- Production: database mode, shared-secret allowlisted-owner authentication, authenticated job routes, fixtures disabled, Target/Walmart/Meijer/online unavailable, reviewed NECA public catalog and Reddit RSS explicitly enabled, daily schedules, and verified backups.

Never let preview deployments poll live retailers automatically.

## Schedule starting point

- Official NECA Store discovery: once daily in `.github/workflows/live-ingestion.yml`. The official storefront currently returns `503` from Vercel egress, so do not move this job back to Vercel until a production smoke succeeds there.
- Active-hunt availability: every 60–120 minutes, only when an approved source supports it and within rate limits.
- Reddit public RSS: once daily on Vercel Hobby. OAuth/API access may use a permitted higher interval only after approval and a hosting-plan review.
- Ranking refresh: event-driven after new evidence plus a daily decay refresh.

Intervals are configuration, not constants. Back off on throttling and expose staleness.

## Deployment sequence

1. Provision managed PostgreSQL and enable backups/point-in-time recovery appropriate to the plan.
2. Add production environment variables in the hosting platform, never in Git.
3. Deploy with live ingestion disabled.
4. Run migrations as a controlled release step.
5. Seed retailers, local stores, source configuration, and the allowlisted user.
6. Smoke-test the separate fixture-only preview at phone and desktop widths; production database mode must not serve synthetic catalog data.
7. Enable the reviewed NECA `public` connector, manually ingest/replay it, then enable Reddit `rss` and repeat. Keep every unimplemented retailer source unavailable.
8. Run a manual ingestion, inspect counts and records, then enable its schedule.
9. Enable alerts for repeated job failure and database capacity.

## Rollback

- Application deploys must be revertible independently of source schedules.
- Prefer backward-compatible additive migrations. Destructive schema changes require a two-release expand/migrate/contract sequence.
- A kill switch disables all live ingestion without disabling the read-only app.
- Set `LIVE_INGESTION_ENABLED=false` for the global kill switch. If isolating one source, set its `*_ADAPTER_MODE=unavailable`; this is source uncertainty and must not be rendered as out of stock.
- Retain the last known good deployment and a documented database restore test.

The detailed PostgreSQL logical backup/restore drill, immutable application rollback, retention job, source kill switches, environment profiles, and disabled schedule manifest are in `docs/OPERATIONS_RUNBOOK.md` and `ops/schedules.production.example.json`. Current migrations are additive; rollback normally reverts the application while leaving the newer compatible schema in place.

## Preview verification

Deploy with fixture data only and no database/schedules/credentials. Then run:

```bash
PREVIEW_BASE_URL=https://preview.example npm run test:preview
```

The preview suite runs the read-only core pages in the 390px mobile and desktop projects, checks headings/titles, horizontal reflow, fixture labels, and serious/critical axe findings.

Owner production deployment: `https://shelf-radar.vercel.app`. It uses managed Neon PostgreSQL, fixtures off, owner Basic authentication, live NECA/Reddit connectors, and source-specific schedules. The authenticated production smoke suite covers mobile and desktop login enforcement, real catalog and public signal provenance, durable classification, listing detail, source health, and serious/critical axe findings.

## Domain and installability

Use a normal HTTPS domain. Add a web app manifest, icons, theme color, and safe-area-aware responsive layout so the site can be added to an iPhone home screen. A full offline/PWA data cache is not required; cached last-known signals with clear timestamps are sufficient.
