# Product Brief

## Product statement

Shelf Radar automatically discovers new TMNT products, builds a normalized cross-retailer identifier catalog, lets one collector decide what to Hunt, Watch, Ignore, or Own, and combines retailer signals with public community sightings to explain which nearby stores are most worth checking.

## Problem

Retail apps are incomplete and sometimes inaccurate, especially for collector products and vendor-managed NECA stock. New drops can be missed, the same product appears under inconsistent titles and IDs, and Ross has no useful public store inventory. The collector already knows local hot and cold stores; the app should add timely evidence without demanding ongoing spreadsheet work.

## Primary user

One collector hunting TMNT products around central Indiana, especially Fishers, Carmel, Westfield, Castleton, Noblesville, and Indianapolis. The first release is single-user and does not need public accounts or multi-tenant community features.

## Core jobs

1. Tell me when a new TMNT product appears across supported retailers.
2. Collect UPC/GTIN and retailer-specific identifiers without requiring me to type them.
3. Let me classify a product with one tap: Hunt, Watch, Ignore, or Own.
4. For an active hunt, show all retailer listings and recent availability signals.
5. Surface relevant public Reddit sightings, including Ross Finds.
6. Rank nearby stores with plain-language reasons and evidence timestamps.
7. Preserve enough wave/assortment structure to add wave activity detection later.

## Primary flows

### Discover

The user sees newly detected canonical products. Each card shows image, name, brand/line, first detected date, identifiers, retailer listings, and classification actions. New items default to `NEW`, not `HUNT`.

### Hunt

The user opens an active product and sees nearby store leads ordered by a transparent score. Each lead shows retailer status, freshness, crowd evidence, known store preference, and penalties or uncertainty.

### Signals

The user sees a chronological feed of product discoveries, availability changes, community sightings, ingestion failures, and wave-related hints. Filters include retailer, source, distance area, product, and freshness.

### Product detail

The user sees the canonical product, identifiers, matching confidence, listing links, status history, related sightings, possible wave memberships, and any duplicate-match review state.

## Retail source behavior

- Target: product discovery, DPCI/TCIN/UPC when exposed, listing details, and store availability signals when an approved source supports them.
- Walmart: product discovery, UPC/GTIN and item IDs, listing details, and availability signals when available.
- Meijer: product discovery, SKU/UPC when available, listing details, and limited/imperfect store signals.
- NECA and selected online retailers: product discovery, release/stock signals, identifiers, and online availability. Keep the configured source list deliberately small.
- Ross: no formal inventory adapter. Treat public crowd reports as the primary inventory-like signal at national, regional, and local levels.

## Crowd behavior

Monitor supported, legitimately accessible Reddit data for:

- `r/TMNT`
- `r/NECATMNT`
- `r/ActionFigures`
- `r/RossFinds`

Match TMNT/line/character/identifier terms together with Target, Walmart, Meijer, Ross, NECA, Indianapolis, Indy, Indiana, Fishers, Carmel, Westfield, Castleton, Noblesville, and configurable nearby regional terms such as Cincinnati and Louisville.

Store post provenance, timestamp, permalink, subreddit, author hash or public display value if needed, extracted location, retailer, product candidates, evidence kind, and confidence reasons. Deduplicate cross-posts and likely reposts without deleting provenance.

## Ranking principles

- Rank, do not promise.
- Labels are `Strong lead`, `Possible lead`, `Weak lead`, and `Insufficient evidence`.
- Display evidence age and last refresh.
- Explain every factor.
- Separate exact product evidence from wave/line evidence.
- A local exact-photo sighting should matter more than a national mention.
- A retailer status unchanged for a long time should decay.
- Store preference is an explicit user-entered prior, never a hidden inference.
- Do not render a percent probability of success in the MVP.

## Success measures

- Newly ingested listings are idempotent and appear for classification.
- Cross-retailer duplicates with a shared UPC are represented as one canonical product.
- The user can classify a product on a phone in two taps or fewer.
- Each ranked store lead has at least one visible factor or is labeled insufficient evidence.
- Ross sightings distinguish national, regional, and named-local-store evidence.
- The app remains useful when one or more external sources are unavailable.

## Explicit exclusions

- Route optimization or driving directions.
- Expansion beyond TMNT in the first release.
- Native mobile applications.
- Automated reading of private Facebook groups; later, a manual share/import may be considered separately.
- Discord bots or servers.
- Complex ML, opaque ranking, or predictive percentages.
- Collection valuation, resale pricing, or marketplace functions.
- Posting back to social networks.
- Broad shelf-photo or package-recognition pipelines.
- Multi-user community features.

## Later, not now

Automated wave detection may be added only after canonical matching is stable and real ingestion data exists. The schema should support waves, assortments, case groups, and evidence-backed relationships now, while automated inference and wave alerts remain disabled.
