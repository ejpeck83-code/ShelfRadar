# Architecture and Normalized Data Model

## System shape

```text
Schedulers / manual refresh
          |
          v
Retail adapters -------- Crowd adapters
Target, Walmart,         Reddit / Ross Finds
Meijer, NECA, online
          |                    |
          +--------+-----------+
                   v
          Validation + provenance
                   v
          Normalization / matching
                   v
              PostgreSQL
                   v
       Ranking + query services
                   v
      Next.js mobile web interface
```

## Bounded modules

- `domain`: canonical entities, value objects, Zod schemas, and pure policies.
- `db`: Drizzle schema, migrations, repositories, and transaction helpers.
- `adapters/retail`: source-specific fetching and parsing.
- `adapters/crowd`: source fetching and raw post parsing.
- `ingestion`: orchestration, idempotency, retries, run records, normalization, and persistence.
- `matching`: deterministic identifier match, candidate generation, aliases, and review queue.
- `ranking`: pure factor calculation and lead labels.
- `app` / `components`: pages, server actions or route handlers, accessible UI.

Dependency direction is inward: adapters and UI may depend on application/domain contracts; domain must not depend on adapters, Next.js, or database implementation details.

## Core entities

### Product

One real-world sellable product or multipack.

- `id` UUID
- `canonicalName`
- `franchise` fixed to `TMNT` for MVP
- `brand`, `manufacturer`, `line`
- `productType`
- `characters` normalized string array or join table
- `description`
- `primaryImageUrl`
- `releaseDate` optional
- `firstDetectedAt`, `lastSeenAt`, `createdAt`, `updatedAt`
- `normalizationStatus`: `CONFIRMED | AUTO_MATCHED | NEEDS_REVIEW`
- `archivedAt` optional

User intent must not live on Product because it is user-specific, even though MVP has one user.

### ProductIdentifier

- `id`, `productId`
- `kind`: `UPC | GTIN12 | GTIN13 | EAN | DPCI | TCIN | WALMART_ITEM_ID | MEIJER_SKU | RETAILER_SKU | MANUFACTURER_SKU`
- `valueNormalized`, `valueDisplay`
- `retailerId` optional
- `sourceListingId` optional
- `confidence`: `EXACT | CLAIMED | PARSED | INFERRED`
- `firstObservedAt`, `lastObservedAt`
- unique constraint appropriate to kind/retailer/value

Normalize GTIN check digits and punctuation. Never collapse retailer-specific SKU namespaces.

### UserProductState

- `id`, `userId`, `productId`
- `state`: `NEW | HUNT | WATCH | IGNORE | OWN`
- `notes`
- `changedAt`
- unique `(userId, productId)`

### Retailer

- `id`, `key`, `name`
- `kind`: `PHYSICAL_AND_ONLINE | ONLINE_ONLY | CROWD_INVENTORY`
- `active`

Ross uses `CROWD_INVENTORY` and has no formal availability observations unless the source is explicitly crowd-derived.

### RetailerListing

One retailer page/offer linked to one canonical product.

- `id`, `productId`, `retailerId`
- `retailerProductId` optional
- `canonicalUrl`, `title`, `imageUrl`
- `currency`, `priceMinor` optional
- `listingStatus`: `ACTIVE | PREORDER | OUT_OF_STOCK | REMOVED | UNKNOWN`
- `exclusive` boolean/unknown
- `rawSourceRef` redacted pointer or content hash
- `firstDetectedAt`, `lastCheckedAt`, `lastChangedAt`
- unique `(retailerId, retailerProductId)` when present; canonical URL hash fallback

### Store

- `id`, `retailerId`, `retailerStoreId`
- `name`, `addressSummary`, `city`, `region`, `postalCode`
- `latitude`, `longitude` optional
- `active`
- unique `(retailerId, retailerStoreId)`

Do not store a private home address. The app may store a broad search origin or configured region.

### StoreProfile

Explicit user knowledge about a store.

- `id`, `userId`, `storeId`
- `preference`: integer in a small documented range, default zero
- `lineTags` optional
- `notes`
- `updatedAt`

### AvailabilityObservation

Append-only observation, not current truth.

- `id`, `listingId`, `storeId` optional
- `status`: `IN_STOCK | LIMITED | OUT_OF_STOCK | PICKUP_UNAVAILABLE | PREORDER | ONLINE_ONLY | UNKNOWN | SOURCE_UNAVAILABLE`
- `quantity` optional and only when source explicitly provides it
- `observedAt`, `effectiveAt` optional
- `sourceKind`, `sourceRef`, `parserVersion`
- `idempotencyKey`
- `rawLabel` optional sanitized

Current availability is a projection from the latest valid observation.

### CrowdPost

- `id`, `sourceKey`, `externalPostId`
- `permalink`, `community`, `title`, `bodyExcerpt`
- `authorDisplay` optional or hash
- `postedAt`, `fetchedAt`
- `contentHash`, `parentOrCrosspostId` optional
- `mediaEvidence`: `NONE | PHOTO_LINK | VIDEO_LINK | UNKNOWN`
- `rawSourceRef`
- unique `(sourceKey, externalPostId)`

### Sighting

Structured evidence extracted from one CrowdPost.

- `id`, `crowdPostId`
- `retailerId` optional
- `storeId` optional
- `locationScope`: `NAMED_STORE | LOCAL_CITY | REGIONAL | NATIONAL | UNKNOWN`
- `locationText`, `city`, `region`
- `observedAt` optional; otherwise use posted time with lower confidence
- `evidenceKind`: `EXACT_PRODUCT_PHOTO | EXACT_PRODUCT_TEXT | LINE_OR_WAVE_PHOTO | LINE_OR_WAVE_TEXT | GENERAL_RETAILER_ACTIVITY`
- `confidenceScore` bounded deterministic score
- `confidenceReasons` JSON array of stable reason codes
- `reviewStatus`: `AUTO_ACCEPTED | NEEDS_REVIEW | REJECTED`
- `idempotencyKey`

### SightingProductCandidate

- `sightingId`, `productId`
- `matchType`: identifier, exact alias, character/line, fuzzy title, wave inference
- `score`, `reasonCodes`
- `confirmed` boolean

### Wave and WaveMembership

- `Wave`: `id`, `name`, `brand`, `line`, `retailerId` optional, `releaseWindow`, `status`
- `WaveMembership`: `waveId`, `productId`, `relationship`: `OFFICIAL | ASSORTMENT | CASEMATE | COMMUNITY_ASSOCIATED | INFERRED`
- In MVP, only manually curated or explicitly sourced relationships influence ranking. Automated wave inference remains off.

### RankingSnapshot

- `id`, `userId`, `productId`, `storeId`
- `score` internal ordinal number
- `label`: `STRONG | POSSIBLE | WEAK | INSUFFICIENT`
- `factors` JSON array with code, direction, points, evidence reference, and timestamp
- `calculatedAt`, `rulesVersion`

### IngestionRun

- `id`, `sourceKey`, `jobType`
- `startedAt`, `finishedAt`
- `status`: `RUNNING | SUCCEEDED | PARTIAL | FAILED | SKIPPED`
- counts for fetched, parsed, created, updated, ignored, failed
- `cursor`/checkpoint, error code, sanitized message, parser version

## Matching policy

Order of authority:

1. Exact validated UPC/GTIN match.
2. Exact manufacturer SKU or explicit cross-retailer identifier mapping.
3. Existing retailer listing ID.
4. Exact curated alias plus matching brand/line/character set.
5. Deterministic candidate score from normalized title, brand, line, character, scale, pack count, and release metadata.

Rules:

- Never merge on title similarity alone.
- Conflicting exact identifiers create a review item and an ingestion warning.
- Low-confidence matches remain separate listings/products until reviewed.
- All merges are auditable and reversible through a canonical merge record or admin action.
- Normalization is idempotent.

## Adapter interface sketch

```ts
type AdapterCapability =
  | "product_discovery"
  | "listing_detail"
  | "store_availability"
  | "crowd_posts";

type AdapterResult<T> =
  | { kind: "success"; items: T[]; nextCursor?: string; fetchedAt: string }
  | { kind: "unavailable"; reason: string; retryAfter?: string }
  | { kind: "throttled"; retryAfter?: string }
  | { kind: "malformed"; reason: string; rawRef?: string };

interface RetailDiscoveryAdapter {
  readonly sourceKey: string;
  readonly capabilities: AdapterCapability[];
  discover(input: DiscoveryQuery, ctx: AdapterContext): Promise<AdapterResult<RawListing>>;
  fetchListing?(input: ListingQuery, ctx: AdapterContext): Promise<AdapterResult<RawListing>>;
  fetchAvailability?(input: AvailabilityQuery, ctx: AdapterContext): Promise<AdapterResult<RawAvailability>>;
}

interface CrowdSourceAdapter {
  readonly sourceKey: string;
  fetchPosts(input: CrowdQuery, ctx: AdapterContext): Promise<AdapterResult<RawCrowdPost>>;
}
```

The lead defines the exact interfaces. Specialists implement them without expanding shared contracts unless approved.

## Discovery queries

Seed terms are configurable and versioned. Initial terms include `TMNT`, `Teenage Mutant Ninja Turtles`, `NECA TMNT`, `Last Ronin`, `Mutant Mayhem`, `TMNT GI Joe`, and known manufacturer/line aliases. Query expansion must remain bounded, deduplicated, and observable.

## Transparent ranking v1

The ranking service consumes recent evidence within configurable windows. Suggested initial ordinal weights, owned by the lead and covered by tests:

- Exact named-store crowd sighting within 24 hours: `+40`
- Exact product photo evidence: `+15`
- Exact product text/identifier: `+10`
- Retailer signal changed to in-stock/limited within 12 hours: `+30`
- Retailer in-stock/limited signal 12–36 hours old: `+15`
- Regional same-product Ross activity within 72 hours: `+10`
- Multiple independent corroborating posts: `+10` capped
- Explicit store preference: `-10` to `+10`
- Sighting older than 3 days: decay to zero or negative
- Retail signal unchanged for more than 48 hours: `-10`
- Likely repost or uncertain location: `-15`
- Source unavailable: no negative claim; expose uncertainty

Labels are calibrated with fixtures, not presented as probabilities. Factor output must cite evidence and age. Exact-product and line/wave evidence are visibly distinct.

## Security and privacy

- Single-user authentication may use an allowlisted email through the deployment platform or a minimal auth provider. Development can use a local mock user.
- Internal job routes require a secret and reject browser sessions by default.
- Apply request timeouts, response size limits, SSRF-safe URL handling, and HTML sanitization.
- Do not render arbitrary third-party HTML.
- Avoid retaining full post bodies where an excerpt, content hash, and permalink suffice.
- Define deletion and source takedown behavior.

## Observability

Provide a small admin/status page or structured logs for adapter health, last successful run, item counts, throttling, and parser failures. Never hide a broken source behind empty results.
