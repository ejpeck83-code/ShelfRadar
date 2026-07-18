# Acceptance Criteria and Test Plan

## MVP acceptance criteria

### Foundation

- A fresh clone installs from the committed lockfile.
- Environment validation fails clearly for malformed required values and permits fixture-only development without live credentials.
- Database migrations and seed run on an empty PostgreSQL database.
- CI runs lint, typecheck, unit/integration tests, and production build without live network dependencies.

### Product discovery and normalization

- Target, Walmart, Meijer, NECA, and at least one configured online source have adapters registered with honest capability/availability status.
- Replaying the same source payload twice creates no duplicates.
- Shared valid UPC/GTIN links retailer listings to one canonical product.
- DPCI and TCIN remain Target identifiers; Walmart item ID and Meijer SKU remain namespaced.
- Conflicting exact identifiers create a reviewable conflict, not a silent merge.
- Newly discovered products appear in Discover with source and first-detected timestamp.

### Classification

- The user can move a product among New, Hunt, Watch, Ignore, and Own.
- The state persists and an accidental double-submit is idempotent.
- Ignore and Own suppress active-hunt alerts without deleting catalog history.

### Availability

- Observations are append-only and source-stamped.
- The UI shows status, retailer/store, observed time, freshness, and source availability.
- Source failure is distinguishable from out-of-stock.
- The app never invents a quantity or says “on shelf” without explicit evidence.

### Crowd intelligence and Ross

- Fixtures for all four subreddits ingest incrementally and idempotently.
- Posts are treated as untrusted content and displayed as sanitized excerpts/links.
- Indianapolis-area terms and named stores map to local scopes with explainable reasons.
- Ross posts classify as named-store/local, regional, national, or unknown.
- Cross-post/repost handling preserves source provenance while preventing duplicate lead inflation.
- Exact product evidence is distinct from line/wave activity.

### Ranking

- A product/store lead contains a label, score order, calculation time, and factor list.
- Positive and negative factors link to observations or sightings.
- Stale evidence decays deterministically under a fixed test clock.
- Source unavailable does not masquerade as negative inventory.
- No percentage probability is presented.
- Equal evidence produces deterministic tie-breaking.

### User experience

- Discover, Hunts, Signals, and Product Detail work at 390x844 and desktop widths.
- Primary controls are keyboard accessible, visibly focused, and large enough for touch.
- Loading, empty, stale, partial-source, and error states are designed.
- Links to retailer listings and crowd sources are clearly external.
- Core flow is usable with screen-reader labels and acceptable automated accessibility checks.

### Operations

- Scheduled jobs authenticate, enforce timeouts, record runs, and cannot overlap unsafely.
- Adapter health and last-success timestamps are visible to the owner.
- Logs redact secrets and sensitive query parameters.
- Deployment documentation includes migration, seed, schedule, backup, rollback, and disable-live-ingestion procedures.

## Test layers

### Unit tests

- Identifier normalization/check digits.
- Title/alias tokenization.
- Matching policy and conflict behavior.
- Freshness and ranking factor calculations.
- Location term matching and Ross scope classification.
- Cross-post/repost fingerprints.
- Zod schemas for every raw adapter payload.

### Adapter contract tests

Run the same behavior suite against every adapter:

- capability declaration;
- success, unavailable, throttled, timeout, and malformed response;
- bounded pagination and cursor behavior;
- provenance and parser version;
- deterministic fixture parsing;
- response-size and missing-field handling.

### Integration tests

Use a disposable PostgreSQL database:

- ingest -> normalize -> persist -> repeat;
- exact UPC cross-retailer merge;
- conflicting UPC/SKU review case;
- availability append and projection;
- crowd post -> sighting -> candidate products;
- ranking snapshot from combined retail/crowd/store-profile evidence;
- transaction rollback on partial failure;
- concurrent job/idempotency behavior.

### Browser tests

Critical Playwright paths:

1. Open Discover, inspect a new product, mark Hunt.
2. Open Hunts, view ranked stores and factor explanations.
3. Filter Signals to Ross and local scope.
4. Open Product Detail and retailer/source links.
5. Change Hunt to Own and confirm active lead suppression.
6. Verify degraded-source banner without losing cached data.

Run at a phone viewport and a desktop viewport. Use seeded fixtures and a deterministic clock.

### Accessibility and security checks

- Automated axe scan for core pages plus manual keyboard pass.
- Dependency and secret scanning in GitHub.
- Tests for job-route authentication, HTML/script sanitization, SSRF protections, redirect safety, and authorization of state changes.

### Manual release checklist

- Review representative Target, Walmart, Meijer, NECA, and Ross fixture records.
- Confirm every live source is either approved/configured or visibly unavailable.
- Validate timestamps and Indianapolis timezone presentation around DST boundaries.
- Check the UI outdoors/on a phone-sized viewport for contrast and tap accuracy.
- Trigger each scheduled job once, verify run counts, then verify idempotent rerun.
- Disable one source at a time and confirm graceful degradation.
- Restore a staging database backup.
- Confirm rollback to the prior deployment and migration compatibility.

## Definition of done for a specialist

- Owned capability is implemented without unauthorized cross-boundary edits.
- New tests cover happy path and at least unavailable, malformed, duplicate, and stale cases.
- Full prescribed suite passes.
- Documentation and `.env.example` notes are updated through owned extension points or the coordination note.
- Branch is pushed and PR includes limitations, screenshots where relevant, and exact test results.
- Coordination note names any requested lead changes; no hidden TODOs remain in shared contracts.
