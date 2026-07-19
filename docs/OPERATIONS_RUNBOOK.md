# Operations runbook

## Source matrix at v0.1.0

| Source | Shipped production access | Fixture preview | Live enablement |
| --- | --- | --- | --- |
| Target | Unavailable | Fixture-only | Provider extension point; no connector shipped |
| Walmart | Unavailable | Fixture-only | Provider extension point; no connector shipped |
| Meijer | Unavailable | Fixture-only | Provider extension point; no connector shipped |
| NECA | Unavailable | Fixture-only | Provider extension point; no connector shipped |
| BigBadToyStore | Unavailable | Fixture-only | Compile-time allowlist/provider extension; no connector shipped |
| Reddit / Ross Finds | Unavailable | Fixture-only | OAuth client extension point; no connector composition shipped |

No adapter is live in this release. Setting a flag does not create a connector. Cached database records remain readable and retain original timestamps when a source is unavailable.

## Environment profiles

Preview is read-only synthetic data: `NODE_ENV=production`, `SHELF_RADAR_DATA_MODE=fixture`, `FIXTURE_INGESTION_ENABLED=true`, `LIVE_INGESTION_ENABLED=false`, every adapter mode `fixture`. Do not configure `DATABASE_URL`, schedules, or provider credentials.

Production starts dark: `SHELF_RADAR_DATA_MODE=database`, `AUTH_MODE=shared-secret`, strong unique `AUTH_SECRET` and `CRON_SECRET`, one `ALLOWED_USER_EMAIL`, database URLs, `LIVE_INGESTION_ENABLED=false`, `FIXTURE_INGESTION_ENABLED=false`, and every adapter mode `unavailable`. Use HTTPS only. Store secrets in the platform secret manager.

## Jobs and schedules

The scheduler sends `POST` with `Authorization: Bearer $CRON_SECRET` and no Cookie header. Source routes are `/api/jobs/ingest/{target|walmart|meijer|neca|online|reddit}`; retention is `/api/jobs/retention`. Each job uses a PostgreSQL advisory lease. A collision returns `409` and `Retry-After: 60`. Scheduled run keys are deterministic per source/minute, and ingestion tables record sanitized status/counts.

`ops/schedules.production.example.json` is disabled documentation, not an automatically activated scheduler. Attach reviewed entries only to production. Do not attach schedules to previews.

## Enable one approved source

1. Confirm written access approval and provider terms, endpoint allowlist, rate limit, response cap, timeout, redirects, secret handling, and retention.
2. Add the connector at the existing injection boundary with fixtures and contract/security tests. Do not weaken the registry’s production guard without that reviewed composition.
3. Deploy with the source still `unavailable` and global live ingestion off.
4. Set only that source’s mode (`provider` or Reddit `oauth`) and credentials; keep every other source unavailable.
5. Set `LIVE_INGESTION_ENABLED=true`, invoke its job once, inspect the Status page, run counts, provenance and normalized rows, then replay to verify idempotency.
6. Enable only that source’s schedule. Watch throttling, parser failures, stale age and database growth.
7. Disable with its adapter mode first; use `LIVE_INGESTION_ENABLED=false` as the global kill switch.

The v0.1.0 registries intentionally make all production sources unavailable because no approved connector implementation is composed.

## Backup and restore

Enable managed database automated backups/PITR before production. Before each migration, take an on-demand snapshot and a logical custom-format backup:

```bash
export SHELF_RADAR_DATABASE_URL='postgresql://...'
pg_dump --format=custom --no-owner --no-acl --file=/secure/path/shelf-radar-predeploy.dump "$SHELF_RADAR_DATABASE_URL"
pg_restore --list /secure/path/shelf-radar-predeploy.dump
```

Restore into a new, explicitly named staging database—never over production—and run read-only count/integrity checks plus the app smoke suite:

```bash
export SHELF_RADAR_RESTORE_URL='postgresql://.../shelf_radar_restore_verify'
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$SHELF_RADAR_RESTORE_URL" /secure/path/shelf-radar-predeploy.dump
DATABASE_URL="$SHELF_RADAR_RESTORE_URL" npm run db:migrate
```

Record backup ID, timestamp, restore database, row counts, migration version and operator. Delete the temporary restore database through the provider console after evidence is retained.

The 2026-07-19 release-candidate drill restored the 54 KB custom-format backup into the isolated local `shelf_radar_restore_verify` database, successfully replayed additive migrations, and matched all sampled source counts. This proves the repository procedure locally; managed production backups/PITR must still be enabled and tested with the selected database provider before real-data operation.

## Rollback

1. Set `LIVE_INGESTION_ENABLED=false` and all modes unavailable; disable schedules.
2. Roll the app deployment back to the last known-good immutable deployment.
3. Current migrations are additive; leave the database at the newer compatible schema. Do not run destructive down migrations during incident response.
4. If data corruption requires restore, create a new database from PITR/backup, validate it, change the application connection during a maintenance window, then redeploy.
5. Confirm cached catalog/observations remain readable, Status reports sources unavailable, and no job is running.

## Retention, logs and response

Run retention daily. It clears expired crowd excerpts, author hashes and raw pointers after `RAW_SOURCE_RETENTION_DAYS` while preserving minimum IDs/hashes for replay protection. Full provider responses are never persisted. Logs and job responses contain structured counts and sanitized messages only; do not log authorization headers, cookies, URLs containing secrets, or raw payloads.

For a source incident: disable that one mode, preserve cached data, inspect ingestion runs, and label the source unavailable. Never translate failure into out of stock.
