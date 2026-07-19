# UX integration notes

## Core paths

- Discover groups canonical products across retailer listings, exposes source chips and identifiers, and supports one-tap New/Hunt/Watch/Ignore/Own classification.
- Hunts starts with a field board for active products: named-store check cards, direct retailer listing/search links, one-tap owner field observations, last manual check freshness, and transparent lead labels.
- Hunts still ranks retailer observations and crowd reports as ordinal leads. Every lead shows its calculation time, evidence age, positive/negative/neutral factors, and evidence limitation.
- Signals presents sanitized public-post text chronologically and filters retailer plus location scope. Named-store, local-city, regional, national, and unknown scopes remain distinct.
- Product Detail shows every known identifier and retailer listing, append-only availability observations with freshness, degraded-source truth, field-check shortcuts, related public sightings, and the matching basis.
- Source Status declares adapter capabilities and distinguishes deterministic fixture readiness from honest unavailability.

## Truthful states

- Fixture data is labeled on Discover, Hunts, and Signals. It is synthetic and never presented as live inventory.
- `SOURCE_UNAVAILABLE` means the source could not be checked. It never means out of stock.
- Retailer availability is timestamped evidence, not proof that an item is on a shelf.
- Owner field checks are stored as append-only observations with `sourceKind=owner_manual_field_check`. They can strongly influence your own Hunt board, but they are not retailer inventory claims.
- Retailer search/listing links are convenience links only. Opening or searching a retailer site does not create a live source integration.
- Ross is public crowd evidence only. A named-store Ross report does not create a Store or AvailabilityObservation record.
- Rankings use Strong/Possible/Weak/Insufficient labels and factor explanations; the UI never displays a probability percentage.
- Loading and route errors have dedicated App Router surfaces. Empty Hunts and empty/unavailable Signals explain the next action. Partial sources remain visible on Source Status and Product Detail.
- Old fixture timestamps remain visible as age labels rather than being refreshed to appear current.

## Responsive and accessible behavior

- The primary viewport is 390x844, with a four-item bottom navigation and touch targets of at least 44 CSS pixels.
- Product titles wrap, missing images use a text alternative, identifier grids collapse to two columns on a phone, and source-status rows stack instead of compressing.
- Pages use semantic headings, articles, labels, lists, visible keyboard focus, reduced-motion-safe interactions, and sufficient contrast.
- Critical mobile and desktop paths run Playwright plus axe checks for serious and critical accessibility violations.

## Remaining fixture-only behavior

- Hunt crowd factors are injected only in fixture data mode. Database mode ranks persisted retailer observations and does not fabricate crowd evidence.
- Public post links and excerpts are synthetic in fixture mode. Raw third-party HTML is never rendered.
- Live retail providers and Reddit OAuth transport require separately approved connectors; configuration alone does not make them live.
