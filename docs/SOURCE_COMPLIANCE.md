# Source Compliance

## Current source matrix

| Source | Mode in this milestone | Network behavior | Notes |
| --- | --- | --- | --- |
| Target | Fixture or honest unavailable | No live requests | Provider interface exists; no connector or scraping implementation. |
| Walmart | Unavailable | None | Extension stub only. |
| Meijer | Unavailable | None | Extension stub only. |
| NECA | Unavailable | None | Extension stub only. |
| Selected online retailers | Unavailable | None | Extension stub only. |
| Reddit / Ross Finds | Unavailable / not registered yet | None | Schema exists; Ross remains crowd-inventory, not formal inventory. |

## Rules

- Do not scrape authenticated pages, use stored retailer cookies, bypass CAPTCHA, rotate proxies, evade bot controls, or ignore provider terms/robots directives.
- Live execution requires `LIVE_INGESTION_ENABLED=true`, a provider-specific mode, and all required approved credentials. Preview and CI stay fixture-only.
- Apply bounded pagination, configured timeouts/rate limits, response-size limits, and retry guidance. Never retry without a bound.
- Validate external data with Zod and render only code-native text; never inject third-party HTML.
- Redact credentials, query secrets, and private data from logs/raw references. Commit only synthetic fixtures.
- An unavailable or throttled source is operational uncertainty, not evidence of out-of-stock status.
