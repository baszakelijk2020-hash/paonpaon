# Atelier Demo Storefront — Read-Only Parity Inventory

**PHASE 20.4 · read-only · no code or architecture change.**
Source of truth: `apps/customer/app/r/[slug]/` at the Stage 20 integration
branch. Companion detail: `docs/evidence/atelier-demo-baseline/v1-2026-08-26/`.

## 1. Route / data substitution surface

The storefront home is a **Route Handler** (`route.ts` `GET`) returning the
founder `paon-template.html` byte-for-byte with exactly 20 `__PAON_*__`
placeholders substituted (`storefront-page-data.ts::serializeStorefrontPage`,
fixed order, throws if any placeholder survives).

| Placeholder                                                           | Value source                                                                                                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__PAON_SLUG__` / `__PAON_RETAILER_ID__`                              | `retailer` (RetailerRepository.findBySlug → `retailers`)                                                                                                                                                 |
| `__PAON_RETAILER_NAME__`                                              | `retailer.displayName`, HTML-escaped                                                                                                                                                                     |
| `__PAON_PRODUCTS_JSON__`                                              | `entries[]` — active `products` + `product_variants`, canonical category, price (`formatMoney en-US`), color/pattern/season (metadata-backed or heuristic), `soldOut`, concept ids, mill/weave/weightGsm |
| `__PAON_CATEGORY_NAMES_JSON__` / `__PAON_DEFAULT_CATEGORY_JSON__`     | `CANONICAL_CATEGORIES` filtered to populated; default = `?category=` (if populated) else most-populated                                                                                                  |
| `__PAON_LAND_ON_GRID__`                                               | `false` for canonical demo on organic visit, else `true`                                                                                                                                                 |
| `__PAON_CATALOGUE_BY_PRODUCT_JSON__`                                  | `serialize-storefront-catalogue.ts` — accepted `entity_metadata_assignments` + visible concepts + `CatalogueQueryRepository.projectCandidates`                                                           |
| `__PAON_KNOWLEDGE_BY_PRODUCT_JSON__`                                  | `serialize-storefront-knowledge.ts` — accepted concepts + `KnowledgeRepository.projectDiscoveryCandidates` (`knowledge_articles`, ADR-060)                                                               |
| `__PAON_STORES_JSON__`                                                | `atelier-demo` → hardcoded `MAISON_APPOINTMENT_STORES` (Antwerp, Amsterdam); else demo-config `locations` or `retailer.billingAddress`                                                                   |
| `__PAON_WEDDING_PARTIES_JSON__` / `__PAON_GARMENTS_JSON__`            | signed-in customer only — `wedding_parties`, non-retired `wardrobe`                                                                                                                                      |
| `__PAON_TABLESERVICE_SIGNED_IN__`                                     | `resolveAppSession().accountType === "customer"`                                                                                                                                                         |
| `__PAON_BRAND_HEAD__` / `__PAON_BRAND_MARK__` / `__PAON_HERO_HTML__`  | server-built from `retailer.brandTheme` (accent/surface/ink, fonts, radius, logo, hero) + story line (≤72 chars from `prospect_demo_configurations.marketing_headline`) + always-on honesty note         |
| `__PAON_FOOTER_HTML__`                                                | server string; up to 4 store cities, current year, links to `/r/<slug>/appointments`, `#gilda-chat-widget`, `/dashboard`, `/r/<slug>/locations`                                                          |
| `__PAON_OG_TITLE__` / `__PAON_OG_DESCRIPTION__` / `__PAON_OG_IMAGE__` | name (+ story), `Explore <name> on PAON.`, hero → first product img → nebelspiegel fallback                                                                                                              |

Direct table reads in `route.ts`: `retailers`, `products`, `product_variants`,
`collections`, `entity_metadata_assignments` (+ metadata concepts),
`knowledge_articles` (+ discovery relations), catalogue-candidate projection,
`prospect_demo_environments`, `prospect_demo_configurations`; signed-in only:
`customers`, `wedding_parties`, `wardrobe`. No MSW, no hardcoded product JSON —
the template's sample `products` array is fully replaced.

## 2. Inline scripts in the template (unmodified founder code)

| Script                                  | Purpose                                                                                                                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#paon-mobile-detect-early`             | pre-paint; sets/removes `paon-mobile` on `<html>` at `MOBILE_MAX_W = 850`; single source of truth for the mobile layout path (no desktop flash)                                                 |
| GSAP `3.12.5` + `ScrollTrigger` (cdnjs) | scroll-driven reveals, hero/section motion                                                                                                                                                      |
| founder catalogue/grid script           | `getCat()` bucketing (id-scheme heuristic + one-line exact-match addition), category filter chips, product open/close, price/archetype selection, guest favorites (stored as product **slugs**) |
| TableService (`#gilda-chat-widget`)     | concierge chat; font path rewritten by `route.ts` to local `/fonts/TN_Web_Use_Only_2.woff2` (no founder-domain request)                                                                         |

## 3. Interaction inventory

Load: organic `/r/atelier-demo` opens the curated gate (`landOnGrid=false`);
`?category=<populated>` lands directly on the grid; unknown/inactive slug → 404. Grid: founder taxonomy chips (Suits/Jackets/Pants/Knits/Shoes/Shirts/
Outerwear/Evening/Wedding), only populated categories shown; product cards with
image/name/price/brand; sold-out only for stocked lines at 0 qty (never
made-to-order); always-on "fabric & archetype are inspiration" note. PDP
(`/products/<slug>`, React page): knowledge panels when concepts+candidates
exist. Cart: `/cart` + `api/cart-add|cart-update|cart-summary`. Appointments:
`/appointments` + `api/appointment-request` (Antwerp + Amsterdam). Locations:
`/locations`. TableService: `#gilda-chat-widget` + `api/table-service-inquiry|
table-service-message`; signed-in customer can attach wedding parties / wardrobe
garments. Secondary surfaces: `/swipe`, `/configurator`, `/concepts[/<code>]`,
`/events`, `/tie-mate`; token-gated: `/gift/<t>`, `/tenders/<t>`,
`/wardrobe/<t>`, `/corporate/<id>`, `/wedding-parties/join/<t>`. Full list with
expected behaviour: `docs/evidence/atelier-demo-baseline/v1-2026-08-26/interaction-checklist.md`.

## 4. Component boundaries

| Boundary                                                                                                                                                       | Kind                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/r/[slug]` (home)                                                                                                                                             | Route Handler → raw HTML string (no React)                                                                                                                                  |
| `/r/[slug]/products/[productSlug]`, `/cart`, `/appointments`, `/locations`, `/swipe`, `/configurator`, `/concepts*`, `/events`, `/tie-mate`, token-gated pages | React App Router pages under the storefront `layout.tsx`                                                                                                                    |
| `/r/[slug]/api/*`                                                                                                                                              | Route Handlers (JSON) — cart, appointment request, table-service                                                                                                            |
| serializers                                                                                                                                                    | `storefront-page-data.ts`, `serialize-storefront-catalogue.ts`, `serialize-storefront-knowledge.ts` — pure data marshaling, reusable by a future React storefront unchanged |
| `storefront-context.ts`                                                                                                                                        | `cache()`-wrapped request-scoped retailer lookup shared by `layout.tsx` + `route.ts`                                                                                        |
| widgets colocated in `app/r/[slug]/`                                                                                                                           | `table-service-widget.tsx`, `proactive-nudge-widget.tsx`, `track-view.tsx` + their `*-actions.ts` server actions                                                            |

## 5. Parity checkpoints (must hold for any port)

- **P1** template byte-for-byte (668,725 bytes); substitution only; Route Handler, not React.
- **P2** exactly 20 `__PAON_*__` placeholders; all substituted; zero survive in output.
- **P3** founder category taxonomy + `getCat()` heuristic fallback preserved.
- **P4** table-service font served locally; no founder-domain request.
- **P5** canonical-demo behaviour keyed only on `slug === "atelier-demo"` (no env flag).
- **P6** fabric/archetype honesty note on every render.
- **P7** `marketing_headline` sliced to 72 chars for the story line.
- **P8** data-source table set unchanged (§1); no duplicate client-only business state.
- **P9** placeholder substitution order fixed in `storefront-page-data.ts`.
- **Visual/motion/perceived-speed:** match `docs/evidence/atelier-demo-baseline/v1-2026-08-26/` per `docs/plans/ATELIER_DEMO_PARITY_TEST_PLAN.md` C1–C7.

No code, schema, or architecture change is proposed by this inventory.
