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
- Production: explicit live-ingestion enable flags, approved credentials, schedules, backups, and allowlisted user authentication.

Never let preview deployments poll live retailers automatically.

## Schedule starting point

- Product discovery: twice daily per retailer.
- Active-hunt availability: every 60–120 minutes, only when an approved source supports it and within rate limits.
- Reddit crowd fetch: every 30–60 minutes or the permitted interval for the configured API plan.
- Ranking refresh: event-driven after new evidence plus a daily decay refresh.

Intervals are configuration, not constants. Back off on throttling and expose staleness.

## Deployment sequence

1. Provision managed PostgreSQL and enable backups/point-in-time recovery appropriate to the plan.
2. Add production environment variables in the hosting platform, never in Git.
3. Deploy with live ingestion disabled.
4. Run migrations as a controlled release step.
5. Seed retailers, local stores, source configuration, and the allowlisted user.
6. Smoke-test fixture ingestion and UI.
7. Configure one approved live source at a time.
8. Run a manual ingestion, inspect counts and records, then enable its schedule.
9. Enable alerts for repeated job failure and database capacity.

## Rollback

- Application deploys must be revertible independently of source schedules.
- Prefer backward-compatible additive migrations. Destructive schema changes require a two-release expand/migrate/contract sequence.
- A kill switch disables all live ingestion without disabling the read-only app.
- Retain the last known good deployment and a documented database restore test.

## Domain and installability

Use a normal HTTPS domain. Add a web app manifest, icons, theme color, and safe-area-aware responsive layout so the site can be added to an iPhone home screen. A full offline/PWA data cache is not required; cached last-known signals with clear timestamps are sufficient.
