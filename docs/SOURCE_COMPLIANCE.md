# Source Compliance

## Current source matrix

| Source | Mode in this milestone | Network behavior | Notes |
| --- | --- | --- | --- |
| Target | Fixture or honest unavailable | No live requests | Provider interface exists; no connector or scraping implementation. |
| Walmart | Fixture or honest unavailable | No live requests | Provider injection boundary exists; no approved connector is shipped. |
| Meijer | Fixture or honest unavailable | No live requests | Provider injection boundary exists; no approved connector is shipped. |
| NECA | Fixture or honest unavailable | No live requests | Provider injection boundary exists; no approved connector is shipped. |
| Selected online retailers | Fixture or honest unavailable | No live requests | Fixture is allowlisted to BigBadToyStore; no approved connector is shipped. |
| Reddit / Ross Finds | Fixture or honest unavailable | No live requests | OAuth is an injected-client boundary. Ross remains crowd-inventory, never formal availability. |

## Rules

- Do not scrape authenticated pages, use stored retailer cookies, bypass CAPTCHA, rotate proxies, evade bot controls, or ignore provider terms/robots directives.
- Live execution requires `LIVE_INGESTION_ENABLED=true`, a provider/OAuth source mode, all required approved credentials, and an approved injected connector. The shipped repository contains no live connector. Preview and CI stay fixture-only.
- Apply bounded pagination, configured timeouts/rate limits, response-size limits, and retry guidance. Never retry without a bound.
- Validate external data with Zod and render only code-native text; never inject third-party HTML.
- Redact credentials, query secrets, and private data from logs/raw references. Commit only synthetic fixtures.
- An unavailable or throttled source is operational uncertainty, not evidence of out-of-stock status.
