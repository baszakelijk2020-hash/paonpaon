# Night Shift Blockers

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
