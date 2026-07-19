# Changelog

## Unreleased — live production connectivity

- Added persistent-production composition for the official NECA Store read-only catalog and robots-allowed Reddit subreddit RSS.
- Added bounded fixed-host transports with redirect rejection, timeouts, response-size caps, Zod/XML validation, rate-limit outcomes, sanitized crowd content, and deterministic provenance.
- Added daily source schedules: GitHub Actions for NECA discovery, plus Vercel Cron for Reddit sightings and retention. Job routes accept authenticated cookie-free cron `GET` requests as well as manual `POST` requests.
- Enabled reviewed Shopify CDN product images while retaining a strict host/path allowlist.

## [Unreleased]

- Release validation and any authorized post-v0.1.0 changes.

## [0.1.0] - pending authorization

- Added the complete fixture-backed Target discovery-to-classification vertical slice.
- Added bounded fixture/unavailable provider boundaries for Walmart, Meijer, NECA and BigBadToyStore.
- Added fixture/unavailable Reddit and Ross crowd intelligence with sanitization, scope, deduplication, checkpoints and conservative matching.
- Added Discover, Hunts, Signals, Product Detail and Source Status mobile/desktop experiences.
- Added versioned transparent ranking with exact-product evidence stronger than line/wave evidence and no probability claim.
- Added PostgreSQL transactions, advisory job leases, authenticated job routes, source run health/counts, cached-data staleness states and raw-source retention.
- Hardened owner authentication, same-origin mutations, external URL/host validation, redirect behavior, local-only product images and browser security headers.
- Added CI dependency/secret scanning, PostgreSQL integration, critical Playwright, accessibility, preview smoke, backup/restore and rollback procedures.
- Resolved development-tool `esbuild` advisories with exact, compatibility-checked transitive versions.

No external adapter is live in v0.1.0. Production sources are unavailable until individually approved and integrated.
