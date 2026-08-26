# Atelier Demo Storefront — Baseline v1

## Version identity

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| Baseline version     | v1                                                  |
| Captured (date)      | 2026-08-26                                          |
| Repo HEAD at capture | `24be9519d33fa69f3dd10e4547e34ce4a40ec74f`          |
| HEAD commit subject  | `fix(fleet): parse wrapped owned paths`             |
| Branch               | `agent/lane-b-customer-navigation-claude1`          |
| Fleet task           | `phase-20.3` — lane `claude-storefront-baseline`    |
| Owned path           | `docs/evidence/atelier-demo-baseline/`              |
| Declared acceptance  | `pnpm lint && pnpm typecheck`                       |
| Toolchain observed   | node v22.20.0, pnpm 9.15.0, `node_modules/` present |

## What the Atelier Demo is

The Atelier Demo is **not** a static page or a `downloaded_pages/pag*.html`
port. It is a database-seeded retailer rendered live by a Next.js **Route
Handler** that returns the founder's `paon-template.html` byte-for-byte with a
fixed set of `__PAON_*__` placeholders substituted from real Supabase data.

| Attribute                 | Value                                                             |
| ------------------------- | ----------------------------------------------------------------- |
| Retailer slug (canonical) | `atelier-demo` (`CANONICAL_DEMO_RETAILER_SLUG`)                   |
| Display name              | `Nebel & Spiegel`                                                 |
| Seed definition           | `packages/database/src/demo-seed.ts`                              |
| Seed script               | `packages/database/scripts/seed-demo.ts`                          |
| Deploy toggle             | `apps/admin/app/(dashboard)/demo-mode/page.tsx`                   |
| Demo account emails       | `contact+atelier-demo-{role}@nebelspiegel.com`                    |
| Demo password             | `Demo-PAON-2026!` (`DEMO_PASSWORD` in `demo-seed.ts`)             |
| Seeded product count      | ~40 products (6 `paon-broek-*` + fabric lines `…-60xx`), see seed |

## Serving app

| Attribute        | Value                                                           |
| ---------------- | --------------------------------------------------------------- |
| App              | `apps/customer/`                                                |
| Dev command      | `next dev --turbopack -p 3002` (`pnpm dev`)                     |
| Prod command     | `next start -p 3002` (`pnpm start`)                             |
| Port             | 3002                                                            |
| Framework        | Next.js App Router                                              |
| Base URL (dev)   | `http://localhost:3002`                                         |
| Storefront entry | `apps/customer/app/r/[slug]/route.ts` (GET → raw HTML)          |
| Template         | `apps/customer/app/r/[slug]/paon-template.html` (668,725 bytes) |
| Serializer       | `apps/customer/app/r/[slug]/storefront-page-data.ts`            |

## URL map (Atelier Demo)

Base: `http://localhost:3002`

| URL                                            | Source file                                          | Notes                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/r/atelier-demo`                              | `app/r/[slug]/route.ts`                              | Storefront home. Canonical demo opens on curated story/gate first unless `?category=` present. |
| `/r/atelier-demo?category=<Name>`              | `app/r/[slug]/route.ts`                              | Deep link into a canonical category grid; lands directly on grid.                              |
| `/r/atelier-demo/products/<productSlug>`       | `app/r/[slug]/products/[productSlug]/page.tsx`       | PDP (React page).                                                                              |
| `/r/atelier-demo/cart`                         | `app/r/[slug]/cart/page.tsx`                         | Cart.                                                                                          |
| `/r/atelier-demo/appointments`                 | `app/r/[slug]/appointments/page.tsx`                 | Book appointment.                                                                              |
| `/r/atelier-demo/locations`                    | `app/r/[slug]/locations/page.tsx`                    | Store locator.                                                                                 |
| `/r/atelier-demo/swipe`                        | `app/r/[slug]/swipe/page.tsx`                        | Product carousel.                                                                              |
| `/r/atelier-demo/configurator`                 | `app/r/[slug]/configurator/page.tsx`                 | Made-to-order builder.                                                                         |
| `/r/atelier-demo/concepts`                     | `app/r/[slug]/concepts/page.tsx`                     | Inspiration / concepts index.                                                                  |
| `/r/atelier-demo/concepts/<code>`              | `app/r/[slug]/concepts/[code]/page.tsx`              | Single concept.                                                                                |
| `/r/atelier-demo/events`                       | `app/r/[slug]/events/page.tsx`                       | Events.                                                                                        |
| `/r/atelier-demo/tie-mate`                     | `app/r/[slug]/tie-mate/page.tsx`                     | Tie pairing tool.                                                                              |
| `/r/atelier-demo/corporate/<programmeId>`      | `app/r/[slug]/corporate/[programmeId]/page.tsx`      | Corporate programme (token/id gated).                                                          |
| `/r/atelier-demo/gift/<token>`                 | `app/r/[slug]/gift/[token]/page.tsx`                 | Gift link (token gated).                                                                       |
| `/r/atelier-demo/tenders/<token>`              | `app/r/[slug]/tenders/[token]/page.tsx`              | Tender link (token gated).                                                                     |
| `/r/atelier-demo/wardrobe/<token>`             | `app/r/[slug]/wardrobe/[token]/page.tsx`             | Wardrobe link (token gated).                                                                   |
| `/r/atelier-demo/wedding-parties/join/<token>` | `app/r/[slug]/wedding-parties/join/[token]/page.tsx` | Wedding-party join (token gated).                                                              |

### Storefront API routes (same base)

| URL                                              | Source file                                       |
| ------------------------------------------------ | ------------------------------------------------- |
| `POST /r/atelier-demo/api/cart-add`              | `app/r/[slug]/api/cart-add/route.ts`              |
| `POST /r/atelier-demo/api/cart-update`           | `app/r/[slug]/api/cart-update/route.ts`           |
| `GET  /r/atelier-demo/api/cart-summary`          | `app/r/[slug]/api/cart-summary/route.ts`          |
| `POST /r/atelier-demo/api/appointment-request`   | `app/r/[slug]/api/appointment-request/route.ts`   |
| `POST /r/atelier-demo/api/table-service-inquiry` | `app/r/[slug]/api/table-service-inquiry/route.ts` |
| `POST /r/atelier-demo/api/table-service-message` | `app/r/[slug]/api/table-service-message/route.ts` |

## Companion documents

- `data-wiring-inventory.md` — every repository, table, RPC and serializer feeding the storefront.
- `interaction-checklist.md` — the interaction surface to re-exercise on every re-baseline.
- `parity-checkpoints.md` — template/injection invariants that must hold against the founder original.
- `timings.md` — timing fields + how to capture them.
- `screenshots/README.md` — screenshot capture procedure + current status.
- `baseline.json` — machine-readable form of the above.

## Known gaps in v1

- **Screenshots not captured.** Live capture needs the customer app running on
  `:3002` against a Supabase project seeded with the `atelier-demo` retailer.
  Standing that up is outside this read-only lane. Procedure is documented in
  `screenshots/README.md` so a later run can fill `screenshots/*.png` under a
  new baseline version.
- **Timings not measured.** Same blocker. `timings.md` defines the fields and
  the measurement procedure.
