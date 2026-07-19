# Source feasibility and production release gate

Research last verified: 2026-07-19. This document separates a source having an API from Shelf Radar having permission to use it. A responsive endpoint is not sufficient authorization.

## Release gate

Shelf Radar is **not a complete production MVP** until all of these are true:

1. Production classifications persist in managed PostgreSQL.
2. The real NECA catalog refresh is scheduled and a successful production replay is recorded.
3. Crowd ingestion is either scheduled under written provider approval or visibly blocked by current policy.
4. At least one sanctioned source returns real TMNT availability for a named physical store, permits scheduled access and the required display/retention, and has been verified in production.

The current gate is blocked at items 2–4. Persistent classification works. NECA has real persisted data but its GitHub-hosted schedule cannot activate until the workflow reaches the default branch and encrypted production secrets are authorized. Reddit automation is blocked by its current access policy. Target, Walmart, and Meijer have no approved Shelf Radar entitlement.

## Executive matrix

| Source/path | Legitimate interface exists | Consumer local-store availability | Public/self-service access | Scheduled automation | Shelf Radar decision |
| --- | --- | --- | --- | --- | --- |
| Target Partners / Impact | Yes: affiliate catalog | No documented store-level signal | Free application; approval required | Catalog pulls supported after approval | Apply for discovery only; **Pending sanctioned access** for stores |
| Target developer/supplier data | Yes: private Target Plus/POL interfaces | Supplier-owned store/SKU data can exist; not a consumer API | Contracted seller/supplier access only | Contractual/private | Do not implement without Target and manufacturer authorization |
| Walmart Affiliate / Impact | Yes: affiliate catalog | No | Free application; approval required | Catalog pulls supported after approval | Discovery only; **Pending sanctioned access** for stores |
| Walmart Scintilla In-Store NRT | Yes: first-party inventory API | Yes, for an entitled supplier's GTINs | No; supplier/VSP + agreement required | Yes under contract | Best Walmart data, but blocked without TMNT supplier sponsorship |
| Meijer API Manager | Yes: private portal | Unknown | No public registration or documentation | Unknown/private | **Pending sanctioned access** |
| Locally for Meijer | Documented commercial brand API | Store-level availability for covered brand/UPC feeds | Enterprise/invitation, request quote | Only as contracted | Best Meijer candidate; require a TMNT coverage demonstration first |
| NIQ Store Availability | Commercial estimated-availability product | Estimated nearby-store availability | Account + sales approval | Plan/contract dependent | Secondary candidate; coverage and display rights unconfirmed |
| PriceSpider Where to Buy | Commercial local-stock/BOPIS product naming Target and Walmart | Yes in its hosted brand solution | Sales contract, request quote | Near-real-time product; API/export rights private | Ask for a written data license; do not assume its crawler output is licensed for this app |
| Best Buy public Developer API | Yes: first-party Products + Stores APIs | Yes, near-real-time by SKU/store or postal area | Self-service API key | Yes; 50,000/day and 5/second | Lowest-friction legitimate contingency, subject to 72-hour cache and branding terms |

## Target

### Official and partner interfaces

- [Target Partners](https://partners.target.com/) is the official affiliate program. Applications use Impact and are free. Target advertises commissions up to 8%; that is publisher revenue, not an access fee.
- Target's [program terms](https://partners.target.com/termsandconditions) define a merchandiser feed containing TCIN, price, description, and other catalog data. The terms prohibit scraping and require Target's express permission for merchant API use.
- Impact's [catalog API](https://integrations.impact.com/impact-publisher/reference/list-all-items-for-a-catalog) can expose generic catalog fields including price, GTIN, image, URL, and stock availability. Its [current documented limit](https://integrations.impact.com/impact-publisher/reference/rate-limits) is 3,000 product-search requests/hour, with `429`/`Retry-After`; Target-specific field population must be inspected after approval.
- The [Target Developer Portal](https://developer.target.com/) is access-controlled for Target personnel, Target Plus, and invited external users. It publishes no self-service consumer inventory API, pricing, scopes, or rate limits.
- Target supplier data can contain daily store/SKU operational information through Target Partners Online and contracted analytics providers. It belongs to the entitled supplier and is not a resale license for arbitrary Target inventory.

### Local-store and field verdict

Target confirms that customers can manually check local availability, but warns that it changes quickly and is not guaranteed. No public, self-service interface was found for that consumer view. Affiliate catalog access confirms TCIN, price, description, and possibly generic GTIN/online stock. It does **not** document Target store ID, store-specific status, quantity, or store observation timestamp.

| Required field | Target affiliate catalog | Private Target/supplier interface |
| --- | --- | --- |
| UPC/GTIN | Impact schema supports it; Target population unknown | Contract schema unknown |
| Retailer product ID | TCIN documented | Likely, private schema |
| Store ID | No | Possible, entitlement-specific |
| Store availability/status | No documented consumer signal | Possible for supplier-owned products |
| Explicit quantity | No | Possible, contract-specific |
| Provider observation time | Catalog update time only | Daily refresh documented by providers; exact semantics private |

### Approval, cost, reliability, and recommendation

Target affiliate signup is free and approval is discretionary. Target does not publish its approval SLA. Scheduled Impact catalog access is technically supported, but cadence, caching, image display, and permitted use remain governed by the approved program terms. Target may change or terminate the feed. Target's site terms prohibit automated extraction/systematic storage, so browser scraping and unofficial/private endpoints are rejected.

Recommendation: apply for the affiliate feed to improve sanctioned discovery and online signals, but keep local availability **Pending sanctioned access**. Implement store availability only after written Target merchant-API permission or a TMNT manufacturer authorizes its own Target store/SKU feed for Shelf Radar.

### Exact owner action

1. Open [Target Partners](https://partners.target.com/), choose **Apply Now**, create an Impact publisher profile, verify the deployed Shelf Radar URL, and complete identity/tax/payment details.
2. In Impact, use **Discover → Find Brands → Target → Apply**.
3. In the application and by email to `targetpartners@target.com`, request written permission for a private, single-user, server-to-server TMNT tool covering TCIN/UPC, five central-Indiana stores, store/pickup status, explicit quantity only when provided, observation time, daily polling, append-only observations, and 30-day raw-reference retention. Ask for the endpoint, authentication, exact rate limits, caching/display/image terms, and confirmation that consumer local-store data is included.
4. If only catalog access is approved, add these directly to Vercel after the adapter is reviewed: `TARGET_IMPACT_ACCOUNT_SID`, `TARGET_IMPACT_AUTH_TOKEN`, and `TARGET_IMPACT_CATALOG_ID`. Add a Campaign ID only if approved tracking links are used. Do not put a Target password or cookie in Vercel.

## Walmart

### Official and partner interfaces

- Walmart's affiliate program supplies approved Impact catalogs. Membership is [free and approval is required](https://affiliates.walmart.com/page/faqs). Impact catalog fields may support GTIN and online `StockAvailability`, but no consumer store inventory is documented.
- Walmart Marketplace APIs concern a seller's own catalog and fulfillment inventory. They do not expose arbitrary Walmart-store inventory.
- Walmart Data Ventures' [Scintilla In-Store Store Inventory API](https://developer.walmartdataventures.com/apis/reference/nrt-store-inventory-details) is the one official path that meets the data shape: store number, 14-digit GTIN or Walmart item number, location area, status, explicit quantity, and UTC `lastUpdatedTime`; multi-item requests accept up to 100 identifiers.
- The [NRT getting-started rules](https://developer.walmartdataventures.com/apis/docs/nrt-getting-started) restrict visibility to eligible Walmart suppliers/vendors and the GTINs associated with them. A third party must also qualify as a Walmart Data Ventures Verified Service Provider and obtain the subscriber's separate authorization. VSP status alone grants no Walmart data access or downstream display right.

### Field verdict

| Required field | Affiliate catalog | Scintilla In-Store NRT |
| --- | --- | --- |
| UPC/GTIN | Generic schema yes; Walmart population must be verified | GTIN-14 yes |
| Retailer product ID | Generic catalog ID; Walmart Item ID not guaranteed | Walmart item number yes |
| Store ID | No | Store number yes |
| Store availability/status | No | Yes |
| Explicit quantity | No | Yes |
| Provider observation time | Catalog-level update only | UTC `lastUpdatedTime` yes |

### Approval, cost, rate limits, reliability, and recommendation

Affiliate access is free and supports scheduled catalog pulls; Impact documents 3,000 product-search requests/hour. It is useful for sanctioned discovery/online signals only. Walmart's affiliate terms prohibit scraping and price-tracking uses and can terminate access.

Scintilla is contract access. A qualifying supplier must sponsor the GTINs; a third party needs VSP review plus a Service Provider Access Agreement and express downstream-use permission. Walmart reports a $0 VSP application fee and an expected multi-week review, but Scintilla/provider subscription pricing is private. NRT quotas are supplier-assigned and not publicly enumerated. The API is official and near-real-time, but it remains timestamped evidence—not proof the item is physically on a shelf.

Recommendation: do not build Scintilla until NECA, Playmates, Mattel, or another GTIN owner sponsors the use and Walmart confirms display/retention rights. Keep Walmart **Pending sanctioned access**.

### Exact owner action

For catalog-only access, register at [Walmart Affiliates](https://affiliates.walmart.com/register), wait for approval, join Walmart in Impact, then retrieve the Account SID/Auth Token and Walmart catalog ID. Add `WALMART_IMPACT_ACCOUNT_SID`, `WALMART_IMPACT_AUTH_TOKEN`, and `WALMART_IMPACT_CATALOG_ID` directly to Vercel only after approval.

For actual store inventory, first obtain written sponsorship from the TMNT product's Walmart supplier/GTIN owner. Ask its Walmart Data Ventures account manager for Scintilla NRT access and permitted downstream display. A third-party route additionally starts at the [VSP program](https://www.walmartdataventures.com/resources/vsp-landing). After approval, add only the issued values directly to Vercel: `WALMART_SCINTILLA_CONSUMER_ID`, `WALMART_SCINTILLA_KEY_VERSION`, `WALMART_SCINTILLA_PRIVATE_KEY_PEM`, and, for a service provider, `WALMART_SCINTILLA_CONTEXT_IDENTIFIER`.

## Meijer

### Official and licensed-provider interfaces

- Meijer operates an [API Manager](https://apiportal.meijer.com/), but the unauthenticated portal publishes no APIs, documentation, self-service registration, pricing, scopes, or rate limits. Treat it as a private contracted interface.
- Meijer supplier tools such as RangeMe, VendorNet, PIM, and EDI are inbound supplier/item/order systems, not a consumer store-inventory read API.
- [Locally](https://hub.locally.com/reference/stores-by-upc) documents a Stores-by-UPC interface and demonstrably lists Meijer stores. Its brand API can return UPC, Locally product/store IDs, retailer, and in-stock membership. [ShopSense reports](https://hub.locally.com/reference/shopsense-reports) can add quantity, retailer price, report date, and store-feed refresh time. Coverage is brand-authorized; current public evidence does not prove NECA/Playmates TMNT coverage.
- NIQ's commercial Store Availability product advertises estimated nearby availability and bulk UPC requests, but Meijer/TMNT coverage, exact fields, consumer display rights, retention, timestamps, and price are not public.

### Field verdict

| Required field | Direct Meijer portal | Locally candidate |
| --- | --- | --- |
| UPC/GTIN | Unknown/private | UPC yes; other GTIN forms confirm in contract |
| Retailer product ID | Unknown/private | Locally product ID, not confirmed Meijer SKU |
| Store ID | Unknown/private | Locally store ID yes |
| Store availability/status | Unknown/private | Binary/in-stock membership yes |
| Explicit quantity | Unknown/private | ShopSense tier only |
| Provider observation time | Unknown/private | Report/store-feed timestamp; not necessarily per item |

### Approval, cost, reliability, and recommendation

Direct Meijer approval, pricing, rates, and automation rights are private. Locally Headless/API access is Enterprise/invitation and request-quote; rate limits and retention are contract terms. The key feasibility risk is not transport—it is whether Locally has authorized TMNT UPC inventory for central-Indiana Meijer stores and permits this private app to poll, display, and retain it.

Recommendation: pursue Locally first, NIQ second, and a direct Meijer partnership in parallel. Do not buy or implement until a provider demonstrates at least one TMNT UPC at a named Meijer store and grants scheduled/persistent display rights. Keep Meijer **Pending sanctioned access**.

### Exact owner action

Open [Locally pricing](https://join.locally.com/pricing) and request an Enterprise quote/demo with this text:

> I operate a private, single-user TMNT sourcing application. Do you currently receive authorized UPC-level inventory for NECA and/or Playmates TMNT products from Meijer stores in central Indiana? May I display and persist timestamped availability observations, poll on a schedule, and retain cached observations? Please quote Enterprise Headless API or ShopSense access and disclose rate limits, attribution, caching, and retention requirements.

If approved, add `LOCALLY_API_TOKEN`, `LOCALLY_COMPANY_ID` or `LOCALLY_COMPANY_SLUG`, and `LOCALLY_MEIJER_STORE_IDS` directly to Vercel. Never add a Meijer consumer login or cookie.

## Best legitimate path to the local-store gate

There is no low-friction sanctioned Target, Walmart, or Meijer option for arbitrary TMNT store inventory today. The most credible retailer-specific paths are Walmart Scintilla with manufacturer sponsorship and Locally after Meijer/TMNT coverage confirmation. Both require commercial action and written permission.

The fastest technically legitimate contingency is the [Best Buy Developer API](https://developer.bestbuy.com/apis). Its official Products and Stores APIs provide UPC, Best Buy SKU, price, images, online availability, and near-real-time availability for a SKU at named stores. The [terms and documented limits](https://developer.bestbuy.com/legal) allow 50,000 calls/day and 5 calls/second, but require Best Buy attribution/branding and prohibit caching source content beyond 72 hours. This means Shelf Radar must purge or refresh Best Buy-derived content within that limit and cannot use it as a permanent historical dataset without separate written permission.

Owner action: create a developer account through **Get API Key** at [developer.bestbuy.com](https://developer.bestbuy.com/), activate the emailed key, and add it directly to Vercel as `BEST_BUY_API_KEY`. No cost is published for the standard key. Before production enablement, confirm that the current Best Buy TMNT catalog contains relevant products, accept the API terms, and approve adding Best Buy to Shelf Radar's retailer scope. The connector must still ship disabled, pass fixed-host/redirect/timeout/size/rate/retention tests, ingest one real named-store observation, replay idempotently, and display required attribution before this path clears the gate.

## Rejected approaches

- Undocumented retailer endpoints, logged-in scraping, stored browser cookies, CAPTCHA solving, residential proxies, stealth browsers, and anti-bot evasion.
- Scraping vendors that cannot provide written retailer authorization and downstream display/retention rights.
- Google Merchant local-inventory APIs as a read source: they let a merchant write its own inventory; they do not expose consumer-readable retailer inventory.
- Walmart Marketplace inventory, Target Plus seller inventory, and Meijer supplier feeds as substitutes for consumer store inventory.
- Instacart as a general inventory feed: current public developer access does not provide arbitrary merchant data and new business applications are not currently open.

## Implementation rule

No connector moves from `pending-sanctioned-access` to `live` because credentials merely exist. Required evidence is: written scope, approved host and auth, documented schedule/rate/retention rights, a validated real response, named-store provenance and provider timestamp, safe failure behavior, replay idempotency, and a production source-health record. Availability remains an append-only observation and never becomes an on-shelf claim.
