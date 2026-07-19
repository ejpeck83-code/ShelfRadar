# Retail Discovery Sources

Shelf Radar treats retailer data as time-stamped evidence, not proof that an item is physically on a shelf. All Milestone 2 live modes are provider-neutral injection points. This repository contains no invented live API, embedded credential, logged-in scraping, CAPTCHA handling, proxy rotation, or stealth behavior.

## Source status

| Source | Capabilities | Shipped access | Identifiers | Availability semantics |
| --- | --- | --- | --- | --- |
| Walmart | Discovery and adapter-local listing detail; store signals when an approved payload supplies them | Fixture and explicit unavailable modes; approved-provider boundary only, no live connector | Validated UPC/GTIN plus namespaced `WALMART_ITEM_ID` | Exact labels map to observations; missing data is not interpreted as out of stock |
| Meijer | Discovery and adapter-local listing detail; limited store signals | Fixture and explicit unavailable modes; approved-provider boundary only, no live connector | Validated UPC plus namespaced `MEIJER_SKU` | Weak labels map to `UNKNOWN`; absent observations remain absent |
| NECA | Official/approved product discovery and adapter-local listing detail | Fixture and explicit unavailable modes; approved-provider boundary only, no live connector | Validated UPC, manufacturer SKU, and NECA retailer SKU | Online offers use `ONLINE_ONLY`, `PREORDER`, `OUT_OF_STOCK`, or `UNKNOWN`; no store claim |
| BigBadToyStore (selected online source) | Discovery and adapter-local listing detail | Fixture-backed MVP proof; approved-provider boundary only, no live connector | Namespaced online `RETAILER_SKU`, plus validated GTIN if supplied | Online-only/preorder/out-of-stock/unknown only |

The configured online extension is deliberately restricted to the compile-time `bigbadtoystore` allowlist entry and its approved hostnames. It is not an arbitrary URL or arbitrary-site scraper. Adding another source requires a reviewed allowlist/config entry, source schema, sanitized fixture, and contract tests.

## Modes and configuration

Each concrete adapter accepts one of these modes:

- `fixture`: deterministic sanitized payloads under `tests/fixtures/retail`; never performs network I/O.
- `unavailable`: returns a structured `unavailable` result and states that cached data remains visible.
- `provider`: accepts only an explicitly injected approved provider implementation. If none is injected, it returns `unavailable` rather than guessing an endpoint.

`WALMART_ADAPTER_MODE`, `MEIJER_ADAPTER_MODE`, `NECA_ADAPTER_MODE`, and `ONLINE_RETAIL_ADAPTER_MODE` select each source independently in development/test. `FIXTURE_INGESTION_ENABLED=false` disables every fixture selection. Production always registers these sources as unavailable until the lead wires an approved provider composition boundary. Enabling `LIVE_INGESTION_ENABLED` alone does not create or claim a connector.

An approved provider must be wired by the lead through a reviewed composition boundary. The adapter-local provider interface accepts `discover` and optional `fetchListing` operations and passes an abort signal, bounded query, request ID, and deterministic clock context.

## Limits and retry guidance

The default local safety policy is shared by the owned adapters:

| Control | Default |
| --- | --- |
| Maximum pages requested per discovery call | 5 |
| Maximum query terms | 20, each at most 120 characters |
| Cursor | Opaque safe-character token, at most 200 characters |
| Provider timeout | 15 seconds |
| Maximum parsed response size | 512,000 bytes |
| Minimum request interval metadata | 1 second |
| Suggested bounded backoff metadata | 30, 120, then 300 seconds |
| Maximum source items per response | Walmart/Meijer/NECA: 200; selected online: 100 |

Adapters preserve provider `retryAfter` timestamps in structured `throttled` or `unavailable` results. They do not retry internally, so the scheduler remains responsible for applying the bounded policy and avoiding overlapping/unbounded retries. Provider error details are not exposed; payload references are sanitized.

## Parser and provenance behavior

Every emitted listing has a stable source key, external ID, fetched timestamp, parser version, and redacted provider reference. Current parser versions are:

- Walmart: `walmart-approved-v1`
- Meijer: `meijer-approved-v1`
- NECA: `neca-approved-v1`
- Selected online allowlist: `online-allowlist-v1`

Source payloads are validated with source-specific Zod schemas before normalization and again against the canonical `RawListing` schema. Invalid GTIN check digits are omitted rather than promoted as exact identifiers. Retailer IDs remain namespaced identifiers and do not become canonical Product fields.

## Known ambiguity and retention

- Walmart and Meijer store states can be incomplete or stale. A positive provider label is only an observation at its timestamp.
- Meijer fixture data intentionally includes weak and missing availability and a listing without UPC.
- NECA and online preorder/stock state is an online offer signal; it says nothing about local retailer shelves.
- Removed listings are retained as `REMOVED` history rather than deleted.
- Duplicate replay is deterministic and relies on the existing listing/identifier/observation idempotency boundaries.
- Raw payloads are not persisted by these adapters. Provenance uses a sanitized reference suitable for the existing retention policy; approved provider integrations must continue to redact sensitive fields.

## Fixture scenarios

The sanitized fixtures cover new listings, preorder, missing UPC, changed price, removed listing, malformed payload, throttling, structured unavailability, and duplicate replay. Tests run entirely against fixtures or injected in-memory providers and make no live network calls.

Run `npm run demo:retail-fixtures` to ingest and replay all registered retail fixtures and print the canonical product count for the UPC shared by Target and Walmart.
