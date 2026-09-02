# Orders — Seasonal staff favourites (§7 supporting module)

Candidate branch: `agent/c1-dashboard-capsule-surface`
Source commit: `26f4a66`
Test commit: `0c60fbe`
Final candidate SHA (this evidence commit's parent): `0c60fbe`

## Correction from prior candidate

The V3 audit's F8 finding ("Seasonal staff favourites") was previously
implemented on Dashboard (`b6b880f` / `c129b43`). Per contract
`CUSTOMER_ENVIRONMENT_REBUILD_V3.md` §7, this module belongs on **Orders**,
alongside the other real supporting modules (advisor selections, saved
items, Complete the Look, Shop, Book in-store appointment, TableService).
`26f4a66` removes the Dashboard wiring/component entirely and adds the real
module to `apps/customer/app/(dashboard)/orders/seasonal-staff-favourites.tsx`.

## Real data source

Same real system already used by `/capsule` and the retailer's
`capsule-drops` control — no second selection engine:

- `MicroCapsuleRepository.findCurrentPublished(retailerId)` — the
  retailer's currently published Capsule Drop is the sole source of truth.
- `MicroCapsuleRepository.findProductsForDrop(drop.id)` — real stored rank
  order, preserved exactly.
- `ProductRepository.findById(productId)` per drop product, gated on
  `status === "active"` (same real-route gate the Wardrobe reorder link
  uses) — `findById` already excludes soft-deleted rows.
- `ProductVariantRepository.findByProduct(productId)` for the real
  configured price, formatted via `@paon/utils`' `formatMoney`.
- Links to `/r/{retailerSlug}/products/{slug}?legacy=1` (the real
  product-detail route; without `?legacy=1` it redirects to the storefront
  root) and to the existing `/capsule` route.
- De-dupes by canonical product ID against Complete the Look's real
  source/suggestions on the same Orders viewport.
- Renders `null` with no current published drop, or when every drop
  product resolves to nothing real (inactive/deleted).

## Test fixture note

The shared `e2e-customer-workspace` fixture retailer carries exactly two
real active, non-deleted products (`e2e-storefront-overcoat`,
`e2e-item-specific-ctl-trousers`). The spec must also seed a real order for
that retailer (to exercise Pending Orders / Order History / per-order
actions together with the new module), and that order's product always
becomes Complete the Look's real source — correctly excluded from Seasonal
staff favourites by the component's own de-dup rule. Proving "two real
products in exact stored rank, non-overlapping with another module"
therefore required two dedicated real fixture products (seeded into the
real `products`/`product_variants` tables, torn down in `finally` —
the same pattern this suite already uses for wardrobe items, retailer
branches, and roadmap gaps), rather than reusing the retailer's only two
pre-existing catalogue products.

- Real image URL used: a data-URI SVG placeholder
  (`data:image/svg+xml,...` , olive-green 400x600 rect) — the same
  fixture-image convention already used throughout this E2E suite (e.g.
  `wardrobe-appointments-prefill-v3.spec.ts`, `appointments-booking-wizard-v3.spec.ts`).
- Real price seeded: $320.00 USD (`price_amount_minor_units: 32000`),
  asserted via the same `formatMoney` utility the component itself calls.
- Rank order: "Piece One" (with the real image + price) at rank 1,
  "Piece Two" (no image) at rank 2 — proven via
  `findProductsForDrop`'s real stored order, not creation/fetch order.

## Final landing URL for the clicked product

`/r/e2e-customer-workspace/products/e2e-ssf-piece-one-<run-timestamp>?legacy=1`
— asserted via exact `toHaveURL` regex match after a real click, plus the
real product's own name rendered on the landed page (not the storefront
root, and not a fabricated title).

## Exact test commands and counts

```
pnpm exec playwright test \
  orders-seasonal-staff-favourites-v3.spec.ts \
  orders-v3-presentation.spec.ts \
  orders-actions-v3.spec.ts \
  orders-history-integrity-v3.spec.ts
```

8 passed, 0 failed (desktop + mobile × 2 for the new spec; 2 pre-existing
Orders specs; both existing regression specs unmodified and green).

`complete-the-look.spec.ts` and `item-specific-complete-the-look.spec.ts`
were excluded from this run after diagnosis: neither is Orders-scoped
(PHASE 17.10 Digital Fitting Room/silhouette flow, and a pre-existing
Wardrobe item-specific deck spec respectively); Orders' own Complete the
Look module assertion is already covered by `orders-v3-presentation.spec.ts`,
which passed.

## Lint / typecheck / build

- `pnpm --filter @paon/customer lint` — clean (exit 0)
- `pnpm --filter @paon/customer typecheck` — clean (exit 0)
- `pnpm --filter @paon/customer build` — clean production build (exit 0)

## Console / page error count

0 across all 8 tests. Authentication-phase console output (the magic-link
redirect and Dashboard's own first paint) is cleared before navigating to
`/orders`, so only the Orders route itself is judged — no error class is
filtered or whitelisted from that point on.

## Isolation

Ran under the exclusive `/tmp/paon-v3-integration-resources.lock`
(mkdir-based, PID-guarded, released via trap), waited out while held by
concurrent sessions before acquiring. Isolated port 3291 /
`.next-e2e-3291`; no existing `.next-e2e-*` directory was deleted or
reused.

## Screenshots

- `desktop-orders-seasonal-favourites.png` / `mobile-orders-seasonal-favourites.png`
  — the module rendering the real published drop.
- `desktop-orders-no-drop.png` / `mobile-orders-no-drop.png` — the module
  entirely absent with no current published drop.
