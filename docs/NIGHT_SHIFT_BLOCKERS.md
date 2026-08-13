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
