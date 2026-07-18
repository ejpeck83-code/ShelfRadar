# Retail Discovery Coordination Note

## Summary

Implemented owned Walmart, Meijer, NECA, and allowlisted online retail discovery adapters by following the Target fixture/unavailable/provider boundary. Each source validates its own payload, normalizes into the unchanged canonical `RawListing` contract, emits parser-versioned provenance, and returns structured unavailable/throttled/malformed outcomes.

The registered online MVP source is deliberately limited to a fixture-backed BigBadToyStore configuration with an explicit hostname allowlist. No live source or API is claimed.

## Starting-point caveat

At task start, the remote exposed neither `main` nor tag `m1-target-slice`. Remote HEAD was `origin/feature/lead-target-vertical` at `0feb435`, whose parent `a6ea9fd` is the Target vertical-slice implementation. The required `feature/retail-discovery` branch was created at `0feb435`, satisfying the requested “tag or later” intent without merging or rebasing.

## Files and configuration

- Adapters: `src/adapters/retail/{walmart,meijer,neca,online}/**`
- Existing registry extension: `src/adapters/retail/registry.ts`
- Fixtures: `tests/fixtures/retail/{walmart,meijer,neca,online}/**`
- Tests: `tests/retail/**`
- Documentation: `docs/RETAIL_SOURCES.md` and this note

No schema, migration, canonical domain, matching, ranking, UI, Target, auth, environment-contract, or deployment file changed. The existing `FIXTURE_INGESTION_ENABLED` registry flag selects fixture versus unavailable mode outside production; production registration is unavailable until lead wiring supplies an approved provider. Approved providers remain constructor-injected boundaries; no credential or endpoint configuration is invented.

## Minimal shared-contract request

The shared `RetailDiscoveryAdapter` currently declares only `discover`, while its capability vocabulary already includes `listing_detail`. The concrete Walmart, Meijer, NECA, and selected-online adapters therefore expose an adapter-local method:

```ts
fetchListing(
  input: { externalId: string },
  context: AdapterContext
): Promise<AdapterResult<RawListing>>;
```

Requested lead change: add optional `fetchListing?` with that signature to `RetailDiscoveryAdapter` (or approve an equivalent lead-owned `ListingQuery` type). Rationale: it lets the ingestion/composition layer call the advertised capability without concrete-class narrowing. Impact: additive and backward compatible for Target and unavailable adapters; no database or canonical listing changes required.

The shared ingestion runner also hard-codes parser version `target-fixture-v1` when starting any adapter run. Requested lead change: add a lead-owned adapter parser-version property or pass parser version into `runDiscovery`. Until then, emitted listing provenance is correct, but non-Target ingestion-run metadata will retain the Target value.

## Verification

- `npx vitest run tests/retail`: passed, 3 files / 31 tests.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- `npm test`: passed, 10 files / 48 tests.
- `npm run build`: passed; Next.js production build compiled and generated all routes.
- `npm run test:integration`: command passed with 1 file / 2 tests skipped because `TEST_DATABASE_URL` is not configured. No schema or repository integration behavior changed.
- Implementation commit SHA: `7edb6ec1b0aef4805ba2f35e274cd19edc683bdf`.

## Known limitations

- Provider mode is an approved-provider injection boundary only; no live provider is configured.
- Scheduler enforcement of minimum intervals/backoff remains lead-owned. Adapters publish policy metadata and preserve `retryAfter`; they do not retry internally.
- Fixture registry mode is global through the existing flag because per-source environment variables are outside specialist ownership.
- Database integration was not expanded; duplicate replay is covered with the existing in-memory repository, and the unchanged full integration suite still requires `TEST_DATABASE_URL`.
