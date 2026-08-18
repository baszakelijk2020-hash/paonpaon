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

**Blocker resolved (2026-08-14, agent/claude-nguyen1):** Commit `9b7b350`
("feat(messaging): add FT-09 unified remote proposal schema/domain/
repository") landed the schema/RPC half out of scope above:
`conversation_proposals` table (versioned per conversation with a partial
unique index enforcing at most one `status='active'` row), `create_
conversation_proposal`/`respond_to_conversation_proposal` security-definer
RPCs (expiry and supersession rejection all verified against a real Postgres
instance), domain types, Zod schemas, and `MessagingRepository` methods
(`createProposal`, `respondToProposal`, `findProposalsByConversation`), with
14 new tests passing. Remaining work is UI only: retailer proposal-composer
surface, customer accept/decline surface, and multi-role browser proof.

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

---

## Lane: agent/claude-nguyen2 (owns apps/admin/**, apps/retailer/**)

Logged by the agent/claude-nguyen2 lane, which owns only `apps/admin/**` and
`apps/retailer/**`. Each entry names the exact out-of-scope change required
so a frontier session (or an agent with broader path ownership) can pick it
up without re-investigating.

## 2026-08-14 — PHASE 10.4 Relationship-calendar campaign packages

**Blocked path:** `packages/domain/src/campaign/relationship-calendar.ts`
(and sibling files under `packages/domain/**`).

**Required change:** the item's own "Missing" note (PHASE.md line ~3401)
names the remaining work precisely: 8 more named library packages
(Valentine/reservation-rescue and overcoat, Mother's/Father's Day,
coming-of-age, Race Sunday, annual event, client event, dating/single-again,
referral) alongside the existing `ANNIVERSARY_MOMENT_LIBRARY_V1`, each
following the same `evaluateRelationshipDateWindow` pattern — sensitive-
context packages additionally need the human-rehearsal gate the item's
Acceptance line requires. This is domain-layer code (`packages/domain`),
which this lane cannot edit.

**Why this blocks apps/admin or apps/retailer work:** the item's remaining
UI pieces (retailer mapping UI for a relationship package, wiring into the
10.1 rehearsal/activation pipeline's candidate gathering) depend on the
library packages existing first — there is nothing in apps/retailer to
build against yet beyond the one proven `ANNIVERSARY_MOMENT_LIBRARY_V1`
pattern (already wired, per the Mission Control anniversary continuation
commits).

**Status:** not started by this lane; deferred entirely to a session with
`packages/**` ownership.

## 2026-08-14 — PHASE 13.3 Omnichannel POS: exchange flow and receipt/fulfilment

**Blocked path:** `packages/domain/src/commerce/pos-transaction.ts` (new
exchange eligibility/planning functions alongside existing
`checkReturnEligibility`/`planReturn`) and `packages/database/src/repositories/pos-repository.ts`
(new repository method(s) analogous to `returnLine`), plus new schema in
`supabase/migrations/` for receipt/fulfilment records (`pos_transactions`
has no `pos_receipts` table or `fulfillment_status` column today).

**Required change:** per PHASE.md's own "Still open" note, 13.3 needs (1)
an exchange flow distinct from a return — combining a refund + a new sale
in one linked transaction, which needs a new domain function/type (no
`planExchange`/`ExchangeEligibility` exists yet) before any UI can be
built against it; and (2) receipt/fulfilment surfaces, which need new
schema before any repository or UI work is possible. Both are pure
domain/schema gaps, not just missing apps/retailer wiring around an
existing primitive.

**Why this blocks apps/admin or apps/retailer work:** there is nothing in
`packages/domain` or the database schema today for an exchange or a
receipt/fulfilment record — apps/retailer has no primitive to wire UI
against. The existing return-flow precedent (`checkReturnEligibility`/
`planReturn` in pos-transaction.ts, `returnLine` in pos-repository.ts,
`returnSaleLine` action in apps/retailer/app/(dashboard)/pos/actions.ts)
is the pattern to follow once the domain/schema pieces land.

**Status:** not started by this lane; deferred entirely to a session with
`packages/**` and `supabase/**` ownership. Remote sale (also named "still
open" in 13.3) not yet investigated — may or may not have the same
cross-path issue.

## 2026-08-14 — Queue-exhaustion sweep: no further apps/admin/apps/retailer work found

Completed this session, in order: reconciled stale `11.1` payroll status to
match reality (commit `872ef8a`); wired `buildRoleDashboard` into
`/analytics` for `14.2` (commits `1f51905`, `8871bf1`). Logged blockers
above for `10.4` and `13.3`.

A systematic pass over every remaining unchecked `- [ ]` item in
`docs/PHASE.md` (Stages 9 through 19, plus all `FT-*` items) found no
further item whose remaining work is buildable purely within
`apps/admin/**` or `apps/retailer/**` against already-existing
`packages/domain`/schema primitives, with dependencies satisfied and no
Docker-only or `apps/customer`-only blocker. Every remaining candidate
falls into one of:

- **Needs `apps/customer/**` UI** (out of this lane's ownership): `12.3`/
  `FT-14` (Preferred Tailoring monthly grid), `16.5` (wedding-planner
  anniversary continuation), `18.3`/`18.4` (public tender/office-visit
  pages), `17.13`'s "periodic fit-check photo → Self-Portrait update" gap
  (schema/RPC already exist —
  `supabase/migrations/20260730180000_add_wardrobe_lifecycle_fit_freshness.sql`'s
  `wardrobe_self_scans`/`wardrobe_attachments` tables and
  `submit_wardrobe_self_scan`/`record_wardrobe_attachment` RPCs — but the
  only missing caller is a customer-facing wardrobe-item card, not a
  retailer/admin surface).
- **Needs new `packages/domain` and/or `supabase/migrations` work**:
  `9.2` (Shopify/Faden scheduled execution needs background-job
  infrastructure), `17.7` (per-customer MTM price lists need a pricing
  engine), `18.7` (production/qc/distribution/launch auto-triggers need
  Stage-12 production-order domain wiring), `13.3`'s remaining pieces
  (logged above), `10.4`'s remaining packages (logged above).
- **Blocked on a founder decision/spec, not code**: `14.1` (new
  employee-portal auth path), `16.4` (the `store_zones.playbook` JSONB
  column exists but has no domain-defined contract for what a playbook
  should contain — building a form against an undefined shape would
  invent the spec rather than implement one), `17.13`'s "unattached
  (logged-out) item" schema change (also needs a `wardrobe_items` schema
  decision, not just code).
- **Genuinely `blocked_external`**: `17.10` (AI try-on provider), `17.12`
  (payment/hardware), `18.11` (external data source access).
- **Is a scoping/legal pass, not an implementation item**: `17.11`
  (supplier-CRM import — "needs its own scoping pass before
  implementation begins," per its own Status line; zero schema exists).
- **Is a comprehensive proof of already-built work, not new scope**:
  `18.13`.

**Status:** no actionable owned task remains in `docs/PHASE.md` as of this
sweep. A future session should either (a) pick up one of the two blockers
logged above with broader path ownership, (b) get a founder answer on the
`16.4` playbook contract or the `17.13` unattached-item schema question,
or (c) re-run this sweep after another lane lands new `packages/domain`/
`supabase` work that unblocks `10.4`, `13.3`, `9.2`, `17.7`, or `18.7`'s
remaining apps/retailer pieces.

## 2026-08-14 — Completeness correction to the sweep above

A self-check found the original sweep did not actually enumerate every
unchecked item in Stages 9–19 despite claiming to. The gap: `9.3`, `10.3`,
`16.1`, `16.2` were never individually assessed. Checked now, none change
the "no actionable task remains" conclusion:

- **`15.1`–`15.5`**: covered by Stage 15's own header — "Stage 15 —
  Lifestyle network and MunroMerchant (**parked**)" with a founder
  override (2026-08-12): "preserve this historical design but do not
  select it for implementation." Correctly out of scope, just never
  named individually in the prior sweep.
- **`16.2`** (Media and future-products incubation): also founder-parked
  (its own status line names this explicitly; also listed in the
  top-of-file parked-items roster). Skip.
- **`9.3`** (Demand-led connector expansion): `blocked_external` — its
  own Status line says no prospect has requested any of the named
  connectors (Lightspeed X, Square, WooCommerce, Endear/Tulip, factory-
  file imports) with real sample data, so there is nothing to build
  against yet.
- **`10.3`** (Unified communication and remote proposals): no hard
  blocker, dependencies (`8.2`, `10.1`) met, but its missing pieces
  (lookbook/proposal/quote attachments, confirmed-note extraction needing
  declared-vs-inferred StyleProfile grounding, opt-out/suppression logic)
  are not one isolated no-caller primitive the way `11.1`/`14.2` turned
  out to be — they are entangled with each other, and confirmed-note
  extraction specifically needs domain-layer grounding work. Not a clean
  apps/retailer-only slice.
- **`16.1`** (Consultancy, guided tiers and staff academy): has the same
  shape as `11.1`/`14.2` at first glance — three domain functions
  (`checkTierCoherence`, `checkProjectTransition`, `checkPublication` in
  `packages/domain/src/knowledge/academy-consultancy.ts`) with zero
  callers, and their backing tables (`guided_tiers`,
  `consultancy_projects`/`consultancy_deliverables`, `knowledge_articles`
  — all in `supabase/migrations/20260801000014_add_knowledge_experience_wedding.sql`)
  are genuinely already migrated. Checked in detail and ruled out anyway:
  unlike `11.1`/`14.2`, **no repository method exists yet** for any of
  the three (nothing in `packages/database` reads these tables or calls
  these functions). Writing that repository method is `packages/database`
  work, outside this lane's ownership — so this is a real, named
  candidate for a session with `packages/**` access: the domain logic and
  schema are done, only the repository-to-UI plumbing is missing, in that
  order (repository first, then apps/retailer UI once it exists).

No further correction expected; this closes the gap the self-check found.
