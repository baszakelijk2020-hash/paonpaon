# Atelier Demo Storefront — Data-Wiring Inventory (v1, 2026-08-26)

All paths relative to repo root. Line numbers are at HEAD
`24be9519d33fa69f3dd10e4547e34ce4a40ec74f`.

## Entry point

`apps/customer/app/r/[slug]/route.ts` — `GET(request, { params })`.
Returns `new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } })`.
No React on the storefront home; the founder template is returned as raw HTML.

## Auth / session

| Concern            | Source                                                |
| ------------------ | ----------------------------------------------------- |
| Supabase client    | `getSupabaseServerClient()` — `@/lib/supabase-server` |
| User               | `supabase.auth.getUser()`                             |
| Session resolve    | `resolveAppSession(authData.user)` — `@paon/auth`     |
| Table-service gate | `tableServiceSignedIn = accountType === "customer"`   |

## Retailer lookup

| Item       | Value                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function   | `getStorefrontRetailer(slug)` — `app/r/[slug]/storefront-context.ts` (React `cache()`, request-scoped)                                                     |
| Repository | `RetailerRepository.findBySlug(slug)` — `@paon/database`                                                                                                   |
| Table      | `retailers`                                                                                                                                                |
| Guard      | 404 unless `retailer && retailer.status === "active"`                                                                                                      |
| Theme      | `retailer.brandTheme` → accent/surface/ink/logo/favicon/hero/fonts/corners → injected `__PAON_BRAND_HEAD__` / `__PAON_BRAND_MARK__` / `__PAON_HERO_HTML__` |

## Catalogue data

| Repository / fn             | Method                                 | Table(s) / RPC                                                |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `ProductRepository`         | `findByRetailer(retailer.id)`          | `products` (filtered to `status === "active"`)                |
| `CollectionRepository`      | `findByRetailer(retailer.id)`          | `collections`                                                 |
| `ProductVariantRepository`  | `findByProducts(productIds)`           | `product_variants`                                            |
| `canonicalCategoryFor(...)` | keyword match over name/collection/img | `app/r/[slug]/canonical-category.ts` (`CANONICAL_CATEGORIES`) |

Category resolution: `?category=` wins only if that canonical category actually
has products; otherwise the most-populated category is the default grid.

## Metadata / fabric facets — `serialize-storefront-catalogue.ts`

`loadStorefrontCatalogueByProduct(client, retailerId, products)`:

| Repository                 | Method                                             | Table(s)                                       |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `MetadataRepository`       | `findAssignmentsForReview(retailerId, "accepted")` | `entity_metadata_assignments`                  |
| `MetadataRepository`       | `findVisibleConcepts(retailerId)`                  | metadata concept tables                        |
| `CatalogueQueryRepository` | `projectCandidates(retailerId)`                    | fabric-weight / catalogue candidate projection |

Projection: `projectStorefrontCatalogueFacets(concepts, weightGsm)` (`@paon/domain`)
→ per-slug `{ color, pattern, season, conceptIds, mill, weave, weightGsm }`.
`preferCatalogueFacetValue()` picks metadata value over the route's heuristic
(`deriveColor` / `derivePattern` / `deriveSeason` in `route.ts`).

## Knowledge panels — `serialize-storefront-knowledge.ts`

`loadStorefrontKnowledgeByProduct(client, retailerId, products)`:

| Repository            | Method                                               | Table(s)                                           |
| --------------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `MetadataRepository`  | `findAssignmentsForReview(retailerId, "accepted")`   | `entity_metadata_assignments`                      |
| `KnowledgeRepository` | `projectDiscoveryCandidates(retailerId, conceptIds)` | `knowledge_articles` + related (ADR-060 discovery) |

Ranking: `rankStorefrontKnowledgePanels({ retailerId, acceptedProductConceptIds, journey: "product_detail" }, candidates)` → `buildStorefrontKnowledgeByProduct(...)`. Empty → `EMPTY_STOREFRONT_KNOWLEDGE_PANELS`.

## Signed-in customer extras (only when `tableServiceSignedIn`)

| Repository               | Method                                      | Table(s)          | Injected as                            |
| ------------------------ | ------------------------------------------- | ----------------- | -------------------------------------- |
| `CustomerRepository`     | `findByUserId(userId)` (match `retailerId`) | `customers`       | (gates the below)                      |
| `WeddingPartyRepository` | `findByCustomer(customer.id)`               | `wedding_parties` | `__PAON_WEDDING_PARTIES_JSON__`        |
| `WardrobeRepository`     | `findByCustomer(customer.id)`               | `wardrobe`        | `__PAON_GARMENTS_JSON__` (non-retired) |

## Demo story / locations

`prospectDemoStoryFor(supabase, slug)` in `route.ts`:

| Step | Table                          | Columns                                                        |
| ---- | ------------------------------ | -------------------------------------------------------------- |
| 1    | `prospect_demo_environments`   | `configuration_id` where `retailer_slug = slug`                |
| 2    | `prospect_demo_configurations` | `locations`, `marketing_headline`, `personalized_introduction` |

`appointmentStoresFor(...)`: for `slug === "atelier-demo"` returns the hardcoded
`MAISON_APPOINTMENT_STORES` (Antwerp `Lombardenstraat 2`, Amsterdam
`PC Hooftstraat 48`). Other retailers fall back to demo-config `locations` or
`retailer.billingAddress`.

`marketingHeadline` is trimmed to **72 chars** for the one-line `storyHtml`
above the grid (ADR-052).

## Server-composed HTML fragments (built in `route.ts`, not from DB rows)

| Injected placeholder                                                  | Built from                                                                                                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__PAON_BRAND_HEAD__`                                                 | `brandHead` — `<style id="paon-retailer-brand">` from `brandTheme` + optional preload/icon links                                                               |
| `__PAON_BRAND_MARK__`                                                 | `brandMark` — `<img class="paon-retailer-logo">` or `""`                                                                                                       |
| `__PAON_HERO_HTML__`                                                  | `heroHtml + storyHtml + catalogueNoteHtml + configHonestyNoteHtml`                                                                                             |
| `__PAON_FOOTER_HTML__`                                                | `footerHtml` — server string; cities from `stores`, current year, links to `/r/<slug>/appointments`, `#gilda-chat-widget`, `/dashboard`, `/r/<slug>/locations` |
| `__PAON_OG_TITLE__` / `__PAON_OG_DESCRIPTION__` / `__PAON_OG_IMAGE__` | `safeName` (+ story line), `Explore <name> on PAON.`, hero → first product img → `https://www.nebelspiegel.com/images/smaller/6088.webp`                       |

## Full placeholder → data map (`storefront-page-data.ts::serializeStorefrontPage`)

Replacement order is fixed and must match `route.ts`. Any `__PAON_*__` left in
the output throws `Storefront template still contains unsubstituted placeholders: …`.

| Placeholder                          | Value source (`StorefrontPageData` field)   | Serialization      |
| ------------------------------------ | ------------------------------------------- | ------------------ |
| `__PAON_SLUG__`                      | `slug`                                      | literal            |
| `__PAON_RETAILER_ID__`               | `retailerId`                                | literal            |
| `__PAON_TABLESERVICE_SIGNED_IN__`    | `tableServiceSignedIn`                      | `"true"`/`"false"` |
| `__PAON_WEDDING_PARTIES_JSON__`      | `weddingParties`                            | `JSON.stringify`   |
| `__PAON_GARMENTS_JSON__`             | `garments`                                  | `JSON.stringify`   |
| `__PAON_RETAILER_NAME__`             | `retailerName` (HTML-escaped `displayName`) | literal            |
| `__PAON_OG_TITLE__`                  | `ogTitle`                                   | literal            |
| `__PAON_OG_DESCRIPTION__`            | `ogDescription`                             | literal            |
| `__PAON_OG_IMAGE__`                  | `ogImage` (HTML-escaped)                    | literal            |
| `__PAON_BRAND_HEAD__`                | `brandHead`                                 | HTML fragment      |
| `__PAON_BRAND_MARK__`                | `brandMark`                                 | HTML fragment      |
| `__PAON_HERO_HTML__`                 | `heroHtml` (hero + story + 2 notes)         | HTML fragment      |
| `__PAON_PRODUCTS_JSON__`             | `entries`                                   | `JSON.stringify`   |
| `__PAON_DEFAULT_CATEGORY_JSON__`     | `defaultCategory`                           | `JSON.stringify`   |
| `__PAON_CATEGORY_NAMES_JSON__`       | `categoryNames` (`resolvedCategories`)      | `JSON.stringify`   |
| `__PAON_LAND_ON_GRID__`              | `landOnGrid`                                | `"true"`/`"false"` |
| `__PAON_STORES_JSON__`               | `stores`                                    | `JSON.stringify`   |
| `__PAON_KNOWLEDGE_BY_PRODUCT_JSON__` | `knowledgeByProduct`                        | `JSON.stringify`   |
| `__PAON_CATALOGUE_BY_PRODUCT_JSON__` | `catalogueByProduct`                        | `JSON.stringify`   |
| `__PAON_FOOTER_HTML__`               | `footerHtml`                                | HTML fragment      |

### Per-product `entries[]` shape (injected as `__PAON_PRODUCTS_JSON__`)

`id` (product slug), `img`, `detailImg`, `name`, `price` (formatted, `en-US`),
`priceMinor`, `color`, `pattern`, `season`, `category` (canonical), `brand`
(retailer display name), `description`, `material` (`"Made to order"` |
`"In atelier"`), `variantName`, `variantId`, `inventoryQuantity`, `soldOut`
(`!isMadeToOrder && qty <= 0`), `conceptIds`, `mill`, `weave`, `weightGsm`.

## External assets referenced by the template / route (not self-hosted)

| Asset                                                                     | Where                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`          | template `<head>`                                 |
| `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js` | template `<head>`                                 |
| `https://www.nebelspiegel.com/images/...` product/hero imagery            | seed data + route fallbacks                       |
| `https://upload.wikimedia.org/...` Antwerp/Amsterdam store photos         | `MAISON_APPOINTMENT_STORES` in `route.ts`         |
| `/fonts/TN_Web_Use_Only_2.woff2` (local)                                  | route rewrites table-service widget font to local |

## Environment flags

| Flag                         | Effect                                                    |
| ---------------------------- | --------------------------------------------------------- |
| `NODE_ENV=development`       | template re-read from disk each request (no module cache) |
| `DEMO_PAYMENTS_ENABLED=true` | enables fake checkout without Stripe (per exploration)    |

No `ATELIER` / `DEMO` on/off flag — demo behaviour is keyed purely on
`slug === CANONICAL_DEMO_RETAILER_SLUG` (`"atelier-demo"`).
