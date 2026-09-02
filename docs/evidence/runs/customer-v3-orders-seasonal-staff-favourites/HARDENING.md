# Orders V3 hardening audit — §7 full pass

Candidate branch: `agent/c1-dashboard-capsule-surface`
Source commit: `8c8770b`
Test commit: `07e6ffd`
Evidence commit: this commit

## Audit scope

Full read of `apps/customer/app/(dashboard)/orders/page.tsx` and
`seasonal-staff-favourites.tsx` against
`CUSTOMER_ENVIRONMENT_REBUILD_V3.md` §7 and every existing Orders E2E
spec (`orders-v3-presentation.spec.ts`, `orders-actions-v3.spec.ts`,
`orders-history-integrity-v3.spec.ts`,
`orders-seasonal-staff-favourites-v3.spec.ts`). Confirmed real, working
routes/handlers for: Pending Orders, Order History, Complete the Look,
Order again, Ask a question, Request service, View order/invoice,
advisor selections (`/wardrobe`), saved items (`/wishlist`), Seasonal
staff favourites, Shop, Book in-store appointment (`/appointments`), and
TableService (`/messages`) — the last six are real, pre-existing,
already-implemented app routes with their own `actions.ts` handlers, not
newly built here.

## Defects found and fixed (source commit `8c8770b`)

1. **"Order again" missing `?legacy=1`.** `reorderHref()` built
   `/r/{slug}/products/{slug}` without the query param the real
   product-detail route (`apps/customer/app/r/[slug]/products/[productSlug]/page.tsx`)
   requires — without it, that route `redirect()`s to the storefront
   root. The action silently bounced instead of landing on the
   customer's real reorder target. Fixed: appended `?legacy=1`, and the
   `OrdersPage` loader now only populates `firstProduct` when the linked
   product's `status === "active"` (same gate Wardrobe's "The size is
   perfect" and Seasonal staff favourites already use) — a stale/inactive
   link is never offered.

2. **Complete the Look's source/suggestion links** had the identical
   missing `?legacy=1`. Fixed the same way; `buildCategorizedCatalogue`
   already filters to `status === "active"` and `ProductRepository`
   already excludes soft-deleted rows, so no additional gate was needed
   there.

3. **Complete the Look imagery used `object-cover`** (cropping real
   garment photography) with a flat `bg-[var(--color-stone-100)]`
   backing instead of `object-contain`. Fixed to match the established
   real-image treatment (§5.3's owned-card pattern, already used by
   Seasonal staff favourites): a restrained blurred `object-cover`
   backing layer behind a full, uncropped `object-contain` foreground —
   the complete original image stays primary and visible.

No new repository, route, fabricated product, price, or confirmation —
these fixes reuse the exact `ProductRepository` / `ProductVariantRepository`
/ `OrderRepository` data this page already loads.

## Test defect found and fixed (test commit `07e6ffd`)

`orders-actions-v3.spec.ts`'s pre-existing "Order again" href assertion
used an anchored regex (`^...$`) with no query-string allowance, so it
would have silently accepted the broken pre-fix href (masking defect #1
above rather than catching it). Strengthened to require the real
`?legacy=1` suffix explicitly — a stricter assertion, not a weaker one.

## No further defects found

Every other Orders control (Pending Orders/History ordering, per-order
action row, "Keep going" support modules, Seasonal staff favourites'
rank/price/image/href/de-dup behavior) was already correct as of the
prior candidate commits (`26f4a66`/`0c60fbe`) and is re-confirmed green
below.

## Exact test commands and counts

```
pnpm exec playwright test \
  orders-seasonal-staff-favourites-v3.spec.ts \
  orders-v3-presentation.spec.ts \
  orders-actions-v3.spec.ts \
  orders-history-integrity-v3.spec.ts
```

8 passed, 0 failed — desktop + mobile × 2 for
`orders-seasonal-staff-favourites-v3.spec.ts`, plus
`orders-v3-presentation.spec.ts` (2), `orders-actions-v3.spec.ts` (1,
now asserting the corrected `?legacy=1` href), and
`orders-history-integrity-v3.spec.ts` (1).

## Lint / typecheck / build

- `pnpm --filter @paon/customer lint` — clean (exit 0)
- `pnpm --filter @paon/customer typecheck` — clean (exit 0)
- `pnpm --filter @paon/customer build` — clean production build (exit 0)

## Console / page error count

0, judged from after authentication completes on every test (same
auth-phase-clearing convention as the prior evidence run); no error
class filtered or whitelisted.

## Isolation

Exclusive `/tmp/paon-v3-integration-resources.lock` (mkdir-based,
PID-guarded, released via trap) — waited out while held by a concurrent
session before acquiring. Isolated port 3301 / `.next-e2e-3301`;
`PAON_E2E_WEBSERVER_TIMEOUT_MS=420000`. No existing `.next-e2e-*`
directory was deleted or reused.

## Screenshots

The prior candidate's `desktop-orders-seasonal-favourites.png` /
`mobile-orders-seasonal-favourites.png` /
`desktop-orders-no-drop.png` / `mobile-orders-no-drop.png` were
re-captured during this hardening run's E2E pass (same assertions,
now against the hardened Orders page) and are included in this
commit unchanged in content/intent from the prior evidence commit.

## Out of scope, deliberately untouched

Pre-existing evidence directories unrelated to this candidate
(`docs/evidence/runs/17.10.json`, `17.13.json`,
`20.12-customer-orders-v3/`, `20.18-customer-orders-actions-v3/`,
`20.27-orders-history-integrity-v3/`) were regenerated locally as a
side effect of running their specs but are intentionally left
uncommitted here, per standing instruction to never touch pre-existing
evidence. `apps/customer/tsconfig.json`'s local `.next-e2e-*` type-path
churn is likewise left uncommitted.
