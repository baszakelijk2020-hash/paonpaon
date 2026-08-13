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

## 2026-08-14 — TableService unified remote proposal (FT-09, critical-path item 4): genuinely blocked outside apps/customer/**

Investigated for implementation this session; **not started** — the
item's own spec (`docs/FOUNDER_TOOL_BLUEPRINTS.md` ~line 1032, "Unified
remote proposal") makes "expiration/versioning (a stale proposal is never
silently treated as still valid)" a named requirement, not an optional
extra. That requires server-side enforcement (a status/expiry/version
column set and an RPC that rejects acceptance of a stale proposal), which
means either:

- a new `proposals` table + RPC in `packages/database` (schema/migration
  work, outside `apps/customer/**`), or
- reusing `conversations`/`messages` with new columns for
  expiry/version/status (still a `packages/database` schema change).

No existing table/repository already models a customer-facing proposal —
confirmed by grep: no `*proposal*.sql` migration, no `ProposalRepository`,
`price_change_proposals` is alteration-pricing only and unrelated. All the
_outcome_ primitives this item is supposed to reuse already exist and are
callable from `apps/customer/**` alone (`MessagingRepository.linkOutcome`,
`OrderRepository.placeOrder`/`checkoutCart`, `AppointmentRepository
.bookFromConsultation`), so once the schema exists the UI/Server-Action
half is a same-session job patterned on `consultation-outcome.spec.ts`
and `one-tap-actions.ts`.

Deliberately not building an unenforced, apps/customer-only stand-in
(e.g. tracking expiry only in a `Message.body` string) — that would let a
customer act on a stale proposal with no server-side check, which is
exactly the failure mode the spec names, and would risk this item being
marked done when it isn't. Skipping this item this session; a future
session with `packages/database` in scope should add the schema/RPC
first, then wire the `apps/customer/**` half described above.

## 2026-08-14 — Queue exhausted for an apps/customer/**-only session

After closing item 3, two independent full sweeps of `docs/PHASE.md`
found no further actionable item satisfying all of: owner boundary
entirely within `apps/customer/**`; not PARKED/DELETED/complete; no
unmet dependency; no hard blocker (Docker, credentials, founder/legal/
provider decision, or required `packages/database` schema/RPC work).

- First sweep walked the "Immediate critical path" ordered list
  (items 4–7+): all blocked (FT-09 above; item 5 needs a scanner-vendor
  decision; item 6 already done; item 7 depends on FT-04, itself blocked
  on Docker for Supabase type regeneration).
- Second sweep walked every remaining unchecked `- [ ] **` item in the
  full file (37 items): only 3 had "Hard blockers: none", and none of
  those 3 has an owner boundary inside `apps/customer/**` (two are
  `apps/retailer/**`-only, one — 18.3 — is already `verified_local`).
  Every other unchecked item is blocked on provider credentials, a
  payment/founder business decision, external hardware/media rights, or
  is out of `apps/customer/**` scope.

No further owned work to start this session. Next session with broader
path authority should start from FT-09's schema gap above, or from
whichever of the credential/decision blockers has since been resolved.
