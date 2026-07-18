# Lead Target Vertical Coordination Note

## Summary

Milestones 0 and 1 establish the strict Next.js/PostgreSQL foundation and fixture-backed Target flow from discovery through classification, detail, observations, source health, and transparent limited-evidence ranking.

## Contracts and migrations

- Canonical Zod contracts: `src/domain/**`
- Drizzle schema: `src/db/schema.ts`
- Initial migration: `drizzle/0000_loving_havok.sql`
- New environment variables: `SHELF_RADAR_DATA_MODE`, optional `TEST_DATABASE_URL`

## Source modes

- Target: fixture and unavailable implemented; provider extension point only; live connector unavailable.
- Walmart, Meijer, NECA, online: unavailable extension stubs.
- Reddit/Ross: not implemented; schema only.

## Verification and limitations

Exact command results and the cohesive feature commit SHA are recorded in the final task completion report after verification. Local PostgreSQL is not installed, so database migration/seed/integration run locally only when `TEST_DATABASE_URL` is provided; CI provisions PostgreSQL.
