# Source Compliance

## Current source matrix

| Source | Mode in this milestone | Network behavior | Notes |
| --- | --- | --- | --- |
| Target | Fixture-only preview or honest unavailable | No live requests | Provider interface exists; no connector or scraping implementation. |
| Walmart | Fixture or honest unavailable | No live requests | Provider injection boundary exists; no approved connector is shipped. |
| Meijer | Fixture or honest unavailable | No live requests | Provider injection boundary exists; no approved connector is shipped. |
| NECA | Fixture, unavailable, or reviewed public catalog | Fixed-host HTTPS GET to the official NECA Store only when enabled | The store's agent instructions explicitly document unauthenticated collection JSON for read-only browsing. |
| Selected online retailers | Fixture or honest unavailable | No live requests | Fixture is allowlisted to BigBadToyStore; no approved connector is shipped. |
| Reddit / Ross Finds | Fixture, unavailable, OAuth boundary, or reviewed public RSS | One fixed-host HTTPS GET to the combined subreddit RSS only when enabled | Reddit robots explicitly allows `/r/*.rss`; Ross remains crowd-inventory, never formal availability. |

## Rules

- Do not scrape authenticated pages, use stored retailer cookies, bypass CAPTCHA, rotate proxies, evade bot controls, or ignore provider terms/robots directives.
- Live execution requires `LIVE_INGESTION_ENABLED=true` and an explicitly reviewed source mode. `NECA_ADAPTER_MODE=public` and `REDDIT_ADAPTER_MODE=rss` are the only credential-free live compositions shipped. Provider/OAuth modes still require approved credentials and injected connectors. Preview and CI stay fixture-only.
- The NECA transport is compile-time fixed to `https://store.necaonline.com/collections/teenage-mutant-ninja-turtles/products.json`; it rejects redirects, bounds pages and bytes, and never performs checkout or cart operations.
- The Reddit RSS transport is compile-time fixed to `https://www.reddit.com/r/{reviewed-community-set}/.rss`; communities are strictly validated, one combined request is used, and search/comment/API endpoints are not scraped.
- Apply bounded pagination, configured timeouts/rate limits, response-size limits, and retry guidance. Never retry without a bound.
- Validate external data with Zod and render only code-native text; never inject third-party HTML.
- Redact credentials, query secrets, and private data from logs/raw references. Commit only synthetic fixtures.
- An unavailable or throttled source is operational uncertainty, not evidence of out-of-stock status.
- Canonical retailer item URLs must use the source’s reviewed hostname allowlist. Approved transports must reject redirects and prevent DNS-rebinding/private-egress access in addition to the canonical URL checks.
