# Atelier Demo Storefront — Interaction Checklist (v1, 2026-08-26)

The interaction surface to exercise on every re-baseline. Derived from
`apps/customer/app/r/[slug]/route.ts`, `paon-template.html`, the storefront
API routes, and the widget components in `app/r/[slug]/`. Status column is the
**expected** behaviour at HEAD `24be9519`; a re-baseline records
Pass/Fail/Changed against it.

## Load & first paint

| #   | Interaction                                                                | Expected                                                                                                         |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | `GET /r/atelier-demo` (organic, no query)                                  | 200 `text/html`. Canonical demo opens on curated story/gate framing (`landOnGrid=false`) — not straight to grid. |
| 2   | `GET /r/atelier-demo?category=Suits` (or any populated canonical category) | 200. Lands directly on that category grid (`landOnGrid=true`).                                                   |
| 3   | `GET /r/atelier-demo?category=<empty category>`                            | 200. Falls back to most-populated category grid; never a blank grid.                                             |
| 4   | Mobile viewport (width ≤ 850)                                              | `#paon-mobile-detect-early` sets `paon-mobile` on `<html>` before first paint — no desktop flash.                |
| 5   | Unknown slug / inactive retailer                                           | 404 `Not found`.                                                                                                 |
| 6   | GSAP + ScrollTrigger load from cdnjs                                       | Scroll animations initialise; no uncaught errors if CDN blocked (graceful).                                      |

## Catalogue grid

| #   | Interaction                                                                                                | Expected                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 7   | Category filter chips (founder taxonomy: Suits/Jackets/Pants/Knits/Shoes/Shirts/Outerwear/Evening/Wedding) | Only categories with ≥1 product appear (`categoryNames` filter); clicking re-filters the grid client-side.     |
| 8   | Product card render                                                                                        | Shows `img`, `name`, `price` (formatted `en-US`), brand = `Nebel & Spiegel`.                                   |
| 9   | Sold-out line                                                                                              | Stocked product with `inventoryQuantity <= 0` shows sold-out; made-to-order never shows sold-out.              |
| 10  | Facet data (color / pattern / season)                                                                      | Metadata-backed value when an accepted concept exists, else route heuristic.                                   |
| 11  | Honesty note under grid                                                                                    | "Fabric & archetype are inspiration — your advisor confirms mill and measurements in fitting." always present. |
| 12  | Story line (if `marketing_headline` seeded)                                                                | One line, ≤ 72 chars, above the grid.                                                                          |

## Product detail (PDP)

| #   | Interaction                                       | Expected                                                                                                               |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 13  | Click product → `/r/atelier-demo/products/<slug>` | React PDP renders for the seeded product.                                                                              |
| 14  | Knowledge panels                                  | ADR-060 discovery panels shown when the product has accepted concepts + candidates; otherwise empty panels (no error). |
| 15  | Add to cart from PDP                              | `POST /r/atelier-demo/api/cart-add` succeeds; cart summary reflects the new line.                                      |

## Cart

| #   | Interaction                                  | Expected                                        |
| --- | -------------------------------------------- | ----------------------------------------------- |
| 16  | `GET /r/atelier-demo/cart`                   | Cart page renders current lines.                |
| 17  | `GET /r/atelier-demo/api/cart-summary`       | Returns line count + totals JSON.               |
| 18  | `POST /r/atelier-demo/api/cart-update`       | Quantity change / removal reflected in summary. |
| 19  | Checkout (with `DEMO_PAYMENTS_ENABLED=true`) | Fake checkout completes without Stripe.         |

## Appointments & locations

| #   | Interaction                                    | Expected                                                                            |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| 20  | `GET /r/atelier-demo/appointments`             | Renders Antwerp + Amsterdam stores (`MAISON_APPOINTMENT_STORES`).                   |
| 21  | `POST /r/atelier-demo/api/appointment-request` | Request accepted; confirmation surfaced.                                            |
| 22  | `GET /r/atelier-demo/locations`                | Store locator lists the same maison stores.                                         |
| 23  | Footer "Ateliers" cities                       | Up to 4 unique cities from `stores`; "All locations" → `/r/atelier-demo/locations`. |

## Table service (Gilda chat widget)

| #   | Interaction                                      | Expected                                                                                                                                                               |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | `#gilda-chat-widget` open                        | Widget mounts; `__PAON_TABLESERVICE_SIGNED_IN__` reflects session.                                                                                                     |
| 25  | `POST /r/atelier-demo/api/table-service-inquiry` | Inquiry accepted.                                                                                                                                                      |
| 26  | `POST /r/atelier-demo/api/table-service-message` | Message posted to the thread.                                                                                                                                          |
| 27  | Signed-in customer                               | Wedding parties (`__PAON_WEDDING_PARTIES_JSON__`) and non-retired wardrobe garments (`__PAON_GARMENTS_JSON__`) available for attachment; empty arrays when signed out. |

## Secondary storefront surfaces

| #   | URL                                                                                                                                | Expected                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 28  | `/r/atelier-demo/swipe`                                                                                                            | Product carousel over the seeded catalogue.                           |
| 29  | `/r/atelier-demo/configurator`                                                                                                     | Made-to-order builder renders.                                        |
| 30  | `/r/atelier-demo/concepts` and `/concepts/<code>`                                                                                  | Concept index + detail.                                               |
| 31  | `/r/atelier-demo/events`                                                                                                           | Events surface renders.                                               |
| 32  | `/r/atelier-demo/tie-mate`                                                                                                         | Tie pairing tool renders.                                             |
| 33  | Token-gated: `/gift/<token>`, `/tenders/<token>`, `/wardrobe/<token>`, `/corporate/<programmeId>`, `/wedding-parties/join/<token>` | Valid token → surface renders; invalid/missing token → gated/omitted. |

## Branding / theme

| #   | Interaction                 | Expected                                                                                                                      |
| --- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 34  | Brand head style block      | `:root` vars `--paon-accent`, `--paon-surface`, `--paon-ink`, retailer fonts, `--retailer-radius` injected from `brandTheme`. |
| 35  | Logo present in theme       | `#sidebar-logo` shows `<img class="paon-retailer-logo">`; `#lagilda-shimmer-unique` hidden.                                   |
| 36  | Hero image present in theme | `.paon-retailer-hero` band renders above grid.                                                                                |
| 37  | OG / Twitter meta           | `og:title` = name (+ story line), `og:image` = hero → first product img → nebelspiegel fallback.                              |

## Invariant

| #   | Check                                     | Expected                                                 |
| --- | ----------------------------------------- | -------------------------------------------------------- |
| 38  | Rendered HTML contains no `__PAON_` token | Guaranteed — `serializeStorefrontPage` throws otherwise. |
