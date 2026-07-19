# Crowd Intelligence

## Purpose and trust boundary

Crowd Intelligence converts public Reddit reports into reviewable `CrowdPost`, `Sighting`, and `SightingProductCandidate` records. It is a lead generator, not proof of shelf inventory. Ross is modeled only as `CROWD_INVENTORY`: this module never writes `AvailabilityObservation` records and never turns a national haul post into a local-stock claim.

Reddit titles, excerpts, links, and metadata are untrusted data. The parser never evaluates HTML, follows instructions in post text, opens media, performs OCR, or classifies images. A media URL only contributes `PHOTO_LINK`, `VIDEO_LINK`, or `UNKNOWN` evidence metadata.

## Access modes

`RedditCrowdAdapter` supports three explicit modes:

- `fixture`: reads committed synthetic pages and makes no network requests.
- `unavailable`: reports operational uncertainty while leaving cached sightings usable.
- `oauth`: requires an injected approved-access client. `RedditOAuthClient` calls only `https://oauth.reddit.com`, sends a bearer token and descriptive user agent, bounds response size and page size, applies a request timeout and minimum interval, and surfaces `429` responses as `throttled` with retry guidance. It does not retry automatically.

OAuth token acquisition and refresh remain outside this adapter-local module so client secrets and refresh tokens never enter payloads, fixtures, raw references, or logs. Live scheduling must remain disabled until the lead-owned environment validation requires explicit live enablement and approved credentials.

The configured communities are exactly:

- `TMNT`
- `NECATMNT`
- `ActionFigures`
- `RossFinds`

## Query terms and checkpoints

Term configuration is normalized, de-duplicated, and bounded to 100 entries per category. Categories cover TMNT names, character aliases, exact product aliases, line/brand aliases, retailer aliases, identifier labels, local locations, and regional locations. The defaults include Indianapolis, Indy, Indiana, Fishers, Carmel, Westfield, Castleton, Noblesville, Cincinnati, and Louisville. `buildRedditQueryTerms` creates one bounded combined set for a scheduler.

The adapter reads the newest subreddit feed with a maximum of 100 posts per page and at most the lesser of the query page limit and configured maximum pages. It filters parsed posts against the bounded query terms. Each successful run returns a versioned checkpoint in the form `reddit:v1:t3_<id>` for the newest seen post. A later run stops as soon as it encounters that fullname, so it emits only newer posts. Invalid checkpoints return `malformed`; they are never silently ignored.

Reddit `after` cursors are used only for bounded pagination inside one read. The durable checkpoint is the newest post fullname, which is less likely to confuse an interrupted older-page traversal with an incremental watermark. Deleted posts are skipped; malformed pages fail closed.

## Sanitization and retention

The adapter validates the Reddit listing shape with Zod before normalization. It removes script/style/iframe elements and their contents, strips remaining tags, control characters, and embedded Markdown images, collapses whitespace, and stores at most 500 characters of body excerpt. Titles are capped at 500 characters. Public author names are replaced by a 12-character SHA-256-derived display hash; deleted authors are omitted.

`rawSourceRef` contains only a deterministic SHA-256 pointer. Full bodies and provider responses are not retained. The existing architecture default is 30 days for raw-source material; source deletion or takedown should clear excerpts/media pointers while retaining only the external ID, content hash, and minimum idempotency metadata needed to avoid replay.

## Extraction rules

Each sighting records the source post ID, posted time, optional observed time, retailer, location scope and text, city/region, media-link presence, evidence kind, identifier mentions, confidence score, deterministic reason codes, and review status.

Observed time is derived only from bounded language (`today`, `this morning`, `just found`, or `yesterday`). Otherwise `observedAt` remains empty and `POSTED_TIME_ONLY` lowers confidence. Evidence older than 72 hours receives `STALE_EVIDENCE`.

Evidence kinds are ordered by specificity:

1. `EXACT_PRODUCT_PHOTO`: a photo link plus a parsed identifier or configured exact product alias.
2. `EXACT_PRODUCT_TEXT`: the same exact evidence without a photo link.
3. `LINE_OR_WAVE_PHOTO`: character/line/brand activity with a photo link.
4. `LINE_OR_WAVE_TEXT`: character/line/brand activity in text.
5. `GENERAL_RETAILER_ACTIVITY`: retailer activity without exact or line evidence.

Identifier labels are configurable and initially cover UPC, GTIN-13, DPCI, TCIN, Walmart item IDs, Meijer SKUs, and manufacturer SKUs. External values are passed through the existing exact-identifier matching service, which applies canonical validation and namespaces. Conflicting exact identifiers create unconfirmed candidates with `CONFLICTING_EXACT_IDENTIFIERS`. Exact identifiers may confirm one candidate. Curated aliases, character/line metadata, and fuzzy title similarity remain unconfirmed and reviewable; title similarity alone never confirms a product.

Representative confidence reasons include `ROSS_NAMED_LOCAL_STORE`, `EXACT_IDENTIFIER`, `PHOTO_LINK_PRESENT`, `LOCAL_LOCATION_TERM`, `REGIONAL_LOCATION_TERM`, `NATIONAL_SIGNAL_NOT_LOCAL`, `LOCATION_UNKNOWN_REVIEW`, `POSTED_TIME_ONLY`, `STALE_EVIDENCE`, `AMBIGUOUS_RETAILER_REVIEW`, and `PRODUCT_MAPPING_REVIEW_REQUIRED`. Scores are deterministic, clamped to 0–100, and are extraction confidence—not an inventory probability.

## Ross location scopes

Ross signals remain distinct:

| Scope | Meaning | Allowed conclusion |
| --- | --- | --- |
| `NAMED_STORE` | Explicit Ross language plus a configured Indianapolis-area place/store descriptor | Strongest Ross lead when paired with exact product/photo evidence; still not guaranteed shelf stock |
| `LOCAL_CITY` | Configured local city/place without a sufficiently specific store phrase | Local-area activity requiring store mapping/review |
| `REGIONAL` | Configured nearby market such as Cincinnati or Louisville | Regional awareness only |
| `NATIONAL` | Explicit nationwide/across-country language | Awareness only; must never imply Indianapolis stock |
| `UNKNOWN` | No usable place signal | Reviewable weak evidence only |

`Indiana` is retained as a bounded broad local-area search term, but a more specific city wins when both occur. Broad or ambiguous mappings remain reviewable. A single Ross post creates a `Sighting`, never a formal availability observation.

## Deduplication and replay

Every valid post is persisted under the idempotent `(sourceKey, externalPostId)` key, preserving its permalink, community, parent/crosspost ID, and hashed raw reference. Evidence is grouped in this order:

1. explicit crosspost parent;
2. exact normalized content hash;
3. deterministic token-set near-duplicate similarity;
4. otherwise the source post ID.

The sighting idempotency key includes the evidence-group key, retailer, evidence kind, and location scope. Cross-posts and likely reposts therefore retain separate `CrowdPost` provenance but share one durable sighting/evidence contribution. Replaying the same page creates neither new posts nor new sightings/candidates.

## Persistence and failure modes

`PostgresCrowdSightingRepository` consumes the lead-owned Drizzle schema and writes only `crowd_posts`, `sightings`, and `sighting_product_candidates`. It reads products, identifiers, retailers, and stores for conservative mapping. It does not update products, listings, rankings, availability, schema, or migrations.

Structured outcomes are:

- `unavailable`: access disabled, missing approved client, abort, timeout, authorization/server failure, invalid JSON, or response-size limit;
- `throttled`: Reddit returned `429`, with retry guidance when supplied;
- `malformed`: query/checkpoint bounds or payload validation failed;
- `success`: sanitized, relevant items plus the newest checkpoint.

The adapter performs no unbounded retry. A scheduler should persist the checkpoint only after its transaction succeeds and should keep the prior checkpoint after partial persistence failure.

## Limitations of public crowd data

- Posters may be mistaken, delayed, joking, reposting old photos, or omitting location/time.
- A photo link proves only that media was linked; the module does not inspect the image.
- Store language can be ambiguous, and seeded Ross store records are not currently present.
- Reddit feed/API behavior and approved-access availability can change.
- Deleted content, private communities, moderation filters, and search recall create false negatives.
- Alias and text rules can confuse brand discussion with a real shelf sighting; ambiguous mappings remain in review.
- National and regional activity may raise awareness but cannot establish local inventory.

## Lead integration decisions

- Canonical `CrowdSourceAdapter`, `CrowdQuery`, and raw crowd-post schemas now live in `src/domain/adapters.ts`; source record keys remain generic rather than exposing Reddit fullname terminology.
- Ingestion runs now carry source parser versions and durable cursors. The prior Reddit checkpoint remains authoritative when persistence fails, and PostgreSQL integration tests cover the complete fetch → persist → checkpoint chain.
- `REDDIT_ADAPTER_MODE` is validated centrally. OAuth mode requires explicit live enablement plus configured credentials, while the registry remains unavailable until an approved-access client is injected.
- Accepted sightings map into the existing versioned ranking vocabulary through a pure crowd-evidence boundary; no new weights or probability language were introduced.
- Ross store rows are not seeded speculatively. Named/local evidence retains its public city/scope while `storeId` remains empty until an authoritative public store mapping is reviewed.
- Curated aliases remain a read-only matching extension point. No alias table or automatic title merge was added.

Facebook, Instagram, TikTok, Discord, screenshot OCR, broad image recognition, and ML inference are intentionally out of scope.
