# Atelier Demo Storefront — Parity Checkpoints (v1, 2026-08-26)

Invariants that keep the served storefront faithful to the founder's original
`paon.html`. A re-baseline confirms each still holds; a violation is a parity
regression.

## P1 — Template is byte-for-byte, substitution only

- `route.ts` header contract: _"Serves the founder's actual `paon.html` file,
  byte-for-byte — every style block, every button, every animation, exactly as
  designed. The only substitution is the `products` array…"_
- The route is a **Route Handler returning raw HTML**, deliberately not a React
  page, so React cannot alter the markup.
- Checkpoint: `apps/customer/app/r/[slug]/paon-template.html` changes only when
  the founder original changes. Size at this baseline: **668,725 bytes**.
  Track drift with:
  `git log --oneline -- 'apps/customer/app/r/[slug]/paon-template.html'`

## P2 — Fixed placeholder set

Exactly these 20 tokens exist in the template and every one is substituted:

```
__PAON_BRAND_HEAD__            __PAON_OG_DESCRIPTION__
__PAON_BRAND_MARK__            __PAON_OG_IMAGE__
__PAON_CATALOGUE_BY_PRODUCT_JSON__  __PAON_OG_TITLE__
__PAON_CATEGORY_NAMES_JSON__   __PAON_PRODUCTS_JSON__
__PAON_DEFAULT_CATEGORY_JSON__ __PAON_RETAILER_ID__
__PAON_FOOTER_HTML__           __PAON_RETAILER_NAME__
__PAON_GARMENTS_JSON__         __PAON_SLUG__
__PAON_HERO_HTML__             __PAON_STORES_JSON__
__PAON_KNOWLEDGE_BY_PRODUCT_JSON__  __PAON_TABLESERVICE_SIGNED_IN__
__PAON_LAND_ON_GRID__          __PAON_WEDDING_PARTIES_JSON__
```

- Checkpoint A: `grep -oE '__PAON_[A-Z0-9_]+__' paon-template.html | sort -u`
  yields exactly this list.
- Checkpoint B: `serializeStorefrontPage` replaces exactly this list, in the
  order defined in `storefront-page-data.ts`, and throws if any `__PAON_`
  survives. The rendered response must contain **zero** `__PAON_` tokens.

## P3 — Founder taxonomy preserved

- The category filter list (Suits / Jackets / Pants / Knits / Shoes / Shirts /
  Outerwear / Evening / Wedding) is the founder's own fixed taxonomy in the
  template — **not** templated.
- PAON only adds: a resolved `category` field per product entry, and a
  one-line addition to the template's `getCat()` that trusts an exact match
  before the founder's original id-scheme heuristic (`broek*` / `schoen*` /
  numeric).
- Checkpoint: `CANONICAL_CATEGORIES` in `app/r/[slug]/canonical-category.ts`
  matches the template's filter list; `getCat()` retains the founder heuristic
  as fallback.

## P4 — Local font, no founder-domain request

- `route.ts` rewrites the table-service widget font path to the local
  `/fonts/TN_Web_Use_Only_2.woff2` so no request goes to the founder's domain.
- Checkpoint: rendered HTML contains no reference to the original external font
  URL for that widget.

## P5 — Canonical-demo behavioural specialisation is slug-keyed only

For `slug === "atelier-demo"` (`CANONICAL_DEMO_RETAILER_SLUG`):

| Behaviour               | Rule                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Landing                 | `landOnGrid = false` on organic visits (curated story/gate first); `true` when `?category=` resolves to a populated category.            |
| Appointment stores      | Hardcoded `MAISON_APPOINTMENT_STORES` — Antwerp (`Lombardenstraat 2, 2000 Antwerp`), Amsterdam (`PC Hooftstraat 48, 1071 BZ Amsterdam`). |
| Shared-photography note | Suppressed for the canonical demo (`slug !== CANONICAL_DEMO_RETAILER_SLUG` guard).                                                       |

- Checkpoint: no `DEMO` / `ATELIER` env flag governs any of this; the only key
  is the slug constant in `packages/database/src/demo-seed.ts`.

## P6 — Honesty notes always rendered

- `configHonestyNoteHtml` ("Fabric & archetype are inspiration — your advisor
  confirms mill and measurements in fitting.") is injected on **every** render,
  not only with shared photography (Critical-1 fix).
- Checkpoint: the string is present in every storefront response.

## P7 — Story line length cap

- `marketing_headline` from `prospect_demo_configurations` is whitespace-
  collapsed, trimmed, and **sliced to 72 chars** for `storyHtml` (ADR-052:
  long Studio intros belong on the private demo gate, not above the grid).
- Checkpoint: rendered story line ≤ 72 chars.

## P8 — Data-source boundary

- Storefront reads only: `retailers`, `products`, `product_variants`,
  `collections`, `entity_metadata_assignments` + metadata concept tables,
  `knowledge_articles` (+ ADR-060 discovery), catalogue-candidate projection,
  `prospect_demo_environments`, `prospect_demo_configurations`, and — only for
  a signed-in customer — `customers`, `wedding_parties`, `wardrobe`.
- No MSW mocks, no hardcoded product JSON in the app. The template's original
  sample `products` array is fully replaced by `__PAON_PRODUCTS_JSON__`.
- Checkpoint: the repository/table list in `data-wiring-inventory.md` matches
  the imports and `.from(...)` calls in `route.ts`,
  `serialize-storefront-catalogue.ts`, `serialize-storefront-knowledge.ts`.

## P9 — Placeholder substitution order fixed

- `serializeStorefrontPage` order is _intentionally_ identical to the route's
  historical order so a future React storefront can consume the same
  `StorefrontPageData` contract unchanged.
- Checkpoint: order in `storefront-page-data.ts` unchanged from this baseline's
  list in `data-wiring-inventory.md`.
