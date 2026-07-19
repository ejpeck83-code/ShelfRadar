# Source Compliance

## Current source matrix

| Source | Mode in this milestone | Network behavior | Notes |
| --- | --- | --- | --- |
| Target | Pending sanctioned access; synthetic preview fixture | No production requests | Affiliate catalog exists, but no approved consumer local-store entitlement. |
| Walmart | Pending sanctioned access; synthetic preview fixture | No production requests | Scintilla store inventory is supplier-restricted; Shelf Radar has no entitlement. |
| Meijer | Pending sanctioned access; synthetic preview fixture | No production requests | Private portal/provider candidates exist; TMNT coverage and rights are unconfirmed. |
| NECA | Fixture, unavailable, or reviewed public catalog | Fixed-host HTTPS GET to the official NECA Store only when enabled | The store's agent instructions explicitly document unauthenticated collection JSON for read-only browsing. |
| Selected online retailers | Fixture or honest unavailable | No live requests | Fixture is allowlisted to BigBadToyStore; no approved connector is shipped. |
| Reddit / Ross Finds | Fixture, unavailable, or approved-access injection boundary | No automatically composed production request | Current policy requires explicit approval for automated data access. Cached sightings remain timestamped crowd evidence. |

## Rules

- Do not scrape authenticated pages, use stored retailer cookies, bypass CAPTCHA, rotate proxies, evade bot controls, or ignore provider terms/robots directives.
- Live execution requires `LIVE_INGESTION_ENABLED=true` and an explicitly reviewed source mode. `NECA_ADAPTER_MODE=public` is the only credential-free live composition shipped. Reddit and retailer provider modes require written approval, approved credentials, and an injected connector. Preview and CI stay fixture-only.
- The NECA transport is compile-time fixed to `https://store.necaonline.com/collections/teenage-mutant-ninja-turtles/products.json`; it rejects redirects, bounds pages and bytes, and never performs checkout or cart operations.
- The retained Reddit RSS parser/client is testable against fixtures but is not composed from environment flags. It may be injected only after Reddit grants explicit automated-access approval and the approved method is re-reviewed.
- Apply bounded pagination, configured timeouts/rate limits, response-size limits, and retry guidance. Never retry without a bound.
- Validate external data with Zod and render only code-native text; never inject third-party HTML.
- Redact credentials, query secrets, and private data from logs/raw references. Commit only synthetic fixtures.
- An unavailable or throttled source is operational uncertainty, not evidence of out-of-stock status.
- Canonical retailer item URLs must use the source’s reviewed hostname allowlist. Approved transports must reject redirects and prevent DNS-rebinding/private-egress access in addition to the canonical URL checks.
