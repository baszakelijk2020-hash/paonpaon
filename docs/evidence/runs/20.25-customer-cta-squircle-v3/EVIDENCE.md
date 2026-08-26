# PHASE 20.25 — claude-customer-cta-squircle-v3 — CTA-system contract proof

No `docs/PHASE.md` prose entry exists for this fleet task (queued ahead of
documentation, same as sibling tasks 20.23/20.24). Scope derived from the
existing, already-shipped founder contract in
`docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:50`:

> CTA controls use one 15px squircle system unless a card-specific
> instruction below says otherwise.

Implemented purely via the Tailwind class `rounded-[15px]` (no dedicated
squircle component/library exists).

## Commit

`688fb6ce842f18bf0c5e994abd352dffc2a4d0f2` — spec file
(cherry-picked from worker commit `c1ef981839533ce0009ff6dddde6470c3a6d53e8`,
independently re-verified by the frontier before acceptance).

## CTA controls tested

- `apps/customer/app/(dashboard)/digital-fitting-room/page.tsx:226` —
  "Start creating →" Link button (primary CTA on the Digital Fitting Room
  landing hero). Verified `rounded-[15px]` class presence and computed
  `border-radius: 15px`, on both desktop (default viewport) and mobile
  (390×844) viewports.

## CTA controls considered and excluded

- `appointments/page.tsx:180` (BookAppointmentLauncher), `paid-care-launcher.tsx:38`
  (PaidCareLauncher), `book-appointment-launcher.tsx` — verified these
  components are not currently imported/rendered by
  `apps/customer/app/(dashboard)/appointments/page.tsx` on this branch
  (frontier-confirmed via direct grep, not just worker narration).
- `r/[slug]/products/[productSlug]/page.tsx:209` — reachable but requires a
  legacy-flag product-detail navigation path; the Digital Fitting Room hero
  button already proves the same control class under the same contract.
- `fitting-room-studio.tsx:230,432`, `wardrobe-panel.tsx:100,775` — card
  containers / empty decorative slots, not actionable CTA controls.
- `account-top-tabs.tsx:82` — mobile "More" overflow menu panel (navigation
  chrome), not a CTA control under this contract.

## Verification (independently re-run by the frontier after cherry-pick, not

worker narration)

- `pnpm --filter @paon/customer lint` — pass, no warnings/errors.
- `pnpm --filter @paon/customer typecheck` — pass, no errors.
- `pnpm exec playwright test customer-cta-squircle-v3.spec.ts` (from
  `apps/customer/`) — 2/2 passed (9.3s, 5.4s).

Note: an initial run of this same spec (both in the worker's isolated
worktree and independently in the frontier's own worktree) failed both
tests with a 45s timeout on the post-magic-link `page.goto('/auth/confirm...')`
navigation. Root-caused to accumulated local Supabase demo-data bloat from
many repeated `seedDemoData()` calls across this long session (unrelated to
this spec or the CTA implementation) — `supabase db reset` cleared it, after
which both tests passed reliably at normal speed. Not a defect in the
proof or the product code.
