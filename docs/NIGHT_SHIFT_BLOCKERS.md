# Night-shift blockers / status handoffs

Cross-path notes from a session scoped to `apps/customer/**` only. Not a
replacement for `docs/PHASE.md` — a future session with authority over
`docs/` should fold these in and delete the corresponding entry here.

## 2026-08-14 — MorningRoutine one-click-buy → real order creation (critical-path item 3)

Implemented within `apps/customer/**` only (no other path touched):

- `apps/customer/app/(dashboard)/morning-routine/actions.ts` —
  `runMorningRoutineAction`'s `"buy"` branch now calls
  `OrderRepository.addToCart` + `.checkoutCart` (same RPCs
  `one-tap-actions.ts`'s `oneTapBuy` uses) against the customer's saved
  default shipping address (`owned.customer.shippingAddresses[0]`), then
  redirects to `/orders/{id}` on success. No payment step, matching the
  item's locked scope. Missing address or missing `productVariantId`
  returns a `formError` instead of throwing.
- `apps/customer/app/(dashboard)/morning-routine/routine-panel.tsx` — the
  "Buy" action now renders a form posting to the same `actionAction`
  (`runMorningRoutineAction`) when `buy.productVariantId` is present,
  falling back to the old product-page `Link` only when no variant is
  resolvable for one-tap creation.
- Added `apps/customer/e2e/morning-routine-buy.spec.ts`, patterned on
  `e2e/one-tap-checkout.spec.ts`: seeds a saved address, generates today's
  routine, clicks "Buy", asserts redirect to `/orders/{id}` and that the
  resulting order is `pending_payment`.

Verified this session: `pnpm --filter customer typecheck`, `lint`, and
`build` all pass clean. **Not verified**: the new e2e spec has not been run
— no local Docker/Supabase available this session (`docker info` fails,
`supabase status` reports the daemon unreachable). A future session with
Docker should run `apps/customer/e2e/morning-routine-buy.spec.ts` (and the
existing `morning-routine.spec.ts`/`one-tap-checkout.spec.ts` for
regression) before marking this `verified_local` in `docs/PHASE.md`.

**Requested `docs/PHASE.md` edit** (lines 254–259 of the "Immediate
critical path" item 3, current text starts "3. **MorningRoutine
one-click-buy → real order creation** — PARTIAL. Buy currently only links
to the product page..."): update the status prefix from `PARTIAL` to
`implemented_unverified` and append a dated status note describing the
above (files touched, no payment step, e2e added but unrun for lack of
Docker this session), following this file's existing per-item status-note
convention (see item 19.1's `Status (2026-08-13)` notes for the format).
