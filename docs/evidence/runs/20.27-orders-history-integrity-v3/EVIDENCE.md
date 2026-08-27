# PHASE 20.27 — claude-orders-history-integrity-v3 — history and duplicate-suppression proof

No `docs/PHASE.md` prose entry exists for this task number. Contract derived
from:

- **PHASE 10.2** (`docs/PHASE.md:3486-3490`): `HoneymoonProgrammeRepository.ensureForOrder`
  is order-linked and idempotent — recomputed fresh from live order status on
  every read (`packages/database/src/repositories/honeymoon-programme-repository.ts:93-188`,
  called on every `/orders/[id]` view via `apps/customer/app/(dashboard)/orders/[id]/page.tsx:61-76`).
- **PHASE 20.12** (`docs/PHASE.md:8266-8268`) / `docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:212-217`:
  Orders page renders "Pending Orders" first, then "Order History"; history
  is the complete purchase record.

## Two prior worker attempts were rejected

Both used a raw `orders` table insert bypassing the canonical `place_order`
RPC and both reported the same anomaly: a non-terminal-status
(`pending_payment`/`placed`) order failed to render in the "Pending Orders"
section. The second attempt's assertion for that claim was also found to be
a **soft check disguised as a hard one** — it only ran the hard
`expect(...).toBeLessThan(...)` assertion when both sections happened to be
visible, silently passing via a log-only branch when the anomaly occurred.
Neither is acceptable per AGENTS.md ("never weaken an acceptance test").

## Frontier root-cause verification (before writing the final spec)

Rather than dispatch a third blind attempt, the frontier independently
verified the actual page behavior directly against a real dev server and
the real Isabelle demo account, using the Playwright MCP browser tool:

1. Isabelle's two real orders are both `delivered` (terminal) — the page
   correctly shows 0 `<section>` labeled "Pending orders" and renders
   "Order archive" / "Order history" correctly. No bug.
2. Temporarily set one of her real orders to `status = 'placed'` via direct
   SQL, reloaded `/orders`: the "Pending orders" section immediately
   appeared correctly (2 `<section>` elements, correct kicker labels, order
   listed under Pending with "Confirmed" status, "In progress" count = 1).
   Reverted immediately after.

**Conclusion: the orders page contract is implemented correctly.** The two
prior workers' anomaly was a fixture/environment artifact (most likely
accumulated test-data pollution across this long session — one worker
reported `findByCustomer()` returning 18 orders for what should have been a
brand-new customer with only 3), not a real product defect.

A separate, unrelated issue also surfaced and was worked around: Supabase's
admin `generateLink({type: "magiclink"})` for a completely new
(never-before-seen) email issues a different underlying verification type
than for an already-confirmed user; `/auth/confirm` (hardcoded to
`type=magiclink`) redirects such attempts to `/login?error=invalid_invite`.
The final spec avoids this by using the existing, already-confirmed
Isabelle account rather than creating a brand-new customer identity.

## What the final spec does

`apps/customer/e2e/orders-history-integrity-v3.spec.ts`: signs in as
Isabelle, inserts two dedicated test orders (`placed` and `delivered`)
directly under her real `customer_id`/`retailer_id` (with a matching
`order_lines` row for the pending one), asserts:

- "Pending orders" section renders above "Order history" (hard
  `boundingBox().y` comparison, unconditional).
- The pending order appears in both sections; the delivered order appears
  only in history; no order id is duplicated within a section.
- The honeymoon-programme timeline on the pending order's detail page is
  byte-identical across two page reloads (idempotency).

Both test orders are removed in a `finally` block regardless of outcome —
confirmed via `psql` after the run that Isabelle's real order history
(`ORD-000001`, `ORD-000002`, both `delivered`) is unchanged.

## Verification

- `pnpm --filter @paon/customer lint` — pass.
- `pnpm --filter @paon/customer typecheck` — pass.
- `pnpm exec playwright test orders-history-integrity-v3.spec.ts` (from
  `apps/customer/`) — 1/1 passed (8.5s).
