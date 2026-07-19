# Hunt Experience UX

## Information architecture

Shelf Radar keeps four owner-facing jobs in the persistent bottom navigation:

1. **Discover** — review newly detected canonical products and classify each as New, Hunt, Watch, Ignore, or Own.
2. **Hunts** — inspect active products and their store leads in the order returned by the existing ordinal ranking service.
3. **Signals** — scan chronological product, availability, crowd, Ross, and source-health evidence with explicit filters.
4. **Product Detail** — inspect the canonical record, identifiers, listings, availability history, sightings, curated relationships, and match-review state.

Status remains a lead-owned operational surface. Product Detail is reached from Discover or Hunts and keeps Discover selected in the existing app navigation.

## Visual system

The implementation extends the established concept at docs/design/shelf-radar-mobile-concept.png:

- true-white page and surface backgrounds;
- editorial black type with compact, legible metadata;
- TMNT green for selected state and positive evidence;
- orange for freshness and review attention;
- hairline dividers and open lists instead of nested card grids;
- small product thumbnails with a text fallback;
- persistent safe-area-aware bottom navigation.

The generated four-screen design exploration was used only to clarify information density and component anatomy. The repository concept remains the color, typography, and shell source of truth. All product text and controls are code-native.

## State language

| State | Language and behavior |
| --- | --- |
| Loading | A labeled aria-busy skeleton identifies which surface is loading. |
| Empty | Explains that no matching cached records are present; never equates an empty source with out of stock. |
| Stale | Shows the retained observation and its age using subdued stale treatment. |
| Partial source | Keeps cached records visible and names the unavailable source in a notice. |
| Source unavailable | Says “source unavailable” and explicitly states that no inventory conclusion was drawn. |
| Error | Offers a retry and reminds the owner that a source error is not an out-of-stock signal. |
| Match review | Says “Review needed” and explains that no automatic merge occurred. |

Retailer status language is always attributed: “Retailer reported in stock,” “listed online,” or “crowd report only.” The UI never says “on shelf” unless a future typed query supplies explicit shelf evidence.

## Ross scope language

- **Named local Ross** — a public report names a local Ross area or store descriptor. It remains crowd evidence, not formal inventory.
- **Local area** — a local city/place is present without enough detail for a named-store mapping.
- **Regional Ross activity** — nearby-market awareness only.
- **National Ross activity** — countrywide awareness only; never converted into an Indianapolis-area claim.
- **Location unknown** — no usable place signal; cannot support a local lead.

The presentation adapter preserves the parser’s scope and adds these fixed labels. Filters operate on scope fields, not title text.

## Responsive behavior

The primary QA viewport is **390 × 844**. At that width:

- product rows use an 86-pixel image rail and allow metadata to truncate safely;
- five classification controls remain in one 44-pixel-tall row;
- signal filters collapse to one control per row;
- detail identifiers use one or two columns depending on available width;
- safe-area padding remains owned by the existing shell.

At **1280 × 720** and the Playwright Desktop Chrome profile:

- the existing 760-pixel reading column is retained for timestamp scanning;
- signal filters expand to five columns;
- product and evidence rows gain image and text space without changing reading order.

## Accessibility decisions

- Semantic header, section, article, ordered lists, description lists, and grouped controls define structure.
- Every product-status button exposes aria-pressed; save progress and the committed state are announced politely.
- Store-factor disclosure uses native details/summary, so it is keyboard operable without custom key handling.
- Filter controls have visible labels and 44-pixel minimum heights.
- Copy controls include the identifier kind and value in their accessible name.
- External links announce the destination/action and use target="_blank" with noopener noreferrer.
- Focus uses the existing three-pixel orange outline; touch controls meet the 44-pixel target.
- Color is never the only status indicator; every tone has text.
- Reduced-motion preferences suppress nonessential transitions.
- Crowd excerpts render as React text only. No raw third-party HTML is accepted by these components.

Automated axe coverage scans Discover, Hunts, Signals, and Product Detail at both configured Playwright projects. Manual keyboard QA covers navigation, status actions, filters, factor disclosure, external links, and copy controls.

## Visual QA record

Reference: docs/design/shelf-radar-mobile-concept.png (1706 × 922 presentation board).

Required rendered captures:

- Discover at 390 × 844;
- Hunts with first factor disclosure open at 390 × 844;
- Signals filtered to Ross + Local at 390 × 844;
- Product Detail at 390 × 844;
- Discover and Signals at 1280 × 720.

Screenshots and traces are kept outside the repository during verification so browser artifacts are not committed. The PR should attach the final mobile and desktop captures.
