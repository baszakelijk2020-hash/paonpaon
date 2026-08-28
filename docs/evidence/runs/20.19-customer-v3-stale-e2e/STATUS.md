# Phase 20.19 — stale V3 E2E reconciliation (partial)

- **Branch HEAD at this work:** `e6e4a30` (agent/claude-v3-review)
- **Owned specs:** `house-memory-fact-correction.spec.ts`,
  `style-profile-account.spec.ts`, `item-specific-complete-the-look.spec.ts`,
  `roadmap-look-review.spec.ts`.

All four were confirmed failing on the release branch against the local
Supabase stack. Root causes and disposition:

## Resolved — deleted (fully-removed UI, already superseded)

### `house-memory-fact-correction.spec.ts` — DELETED

Asserted a `/account` "House Memory" heading and fact-correction flow. V3 §9
removes the entire customer-facing House Memory panel and all House Memory
copy; the `correctOwnCustomerFact` server action and
`account/customer-facts-panel.tsx` no longer exist in `apps/customer/app/`
(confirmed by grep). There is no customer surface left to exercise, so the
UI-level "cross-customer / restricted fail-closed" assertions have nothing to
drive. The V3-conformant replacement assertion already lives in
`account-v3-profile.spec.ts` (`getByText(/house memory/i)` has count 0).
Table-level RLS remains covered by pgTAP.

### `style-profile-account.spec.ts` — DELETED

Asserted a `/account` StyleProfile panel ("Relaxed tailoring",
"Confidence N%", "Remove inference"). V3 §9 removes style-discovery /
Style Portrait from Profile; `account/style-profile-panel.tsx` and
`style-profile-actions.ts` no longer exist. `account-v3-profile.spec.ts`
already asserts their absence ("no 'style portrait'", "no 'remove
inference'", no `a[href='/style-quiz']`). Pure superseded dead weight.

## Blocked — capability relocated, not simply removed

### `item-specific-complete-the-look.spec.ts` — NOT changed

Targets `card.locator("[data-item-complete-the-look]")` — a disclosure on the
owned wardrobe card face. That attribute no longer exists in
`apps/customer/app/` (confirmed by grep). V3 §5.4 relocates
"Complete the look" to the first item of the owned card's `Actions +`
progressive deck (its presence there is already proven by
`wardrobe-v3-presentation.spec.ts`). Retargeting the unique part of this
spec — "tapping it enqueues a real visualization job" — requires the V3
deck's Complete-the-look follow-up screen to be implemented and wired to the
outfit/job enqueue pipeline. That wiring is owned by the Wardrobe deck
implementation lane (20.9 / 20.17), not this test-only lane, and its
completeness is unverified. Retargeting now would assert against a
potentially half-built follow-up. **Blocker: needs the V3 owned-card deck
"Complete the look" follow-up + job-enqueue wiring confirmed present by its
owner before this spec can be retargeted.**

### `roadmap-look-review.spec.ts` — NOT changed

Targets a standalone roadmap panel on `/wardrobe` (`li` containing the
roadmap title, with "Love it" / "Maybe" / "Request change" writing
`wardrobe_visualization_feedback` rows). V3 §5.1 removes "the standalone
roadmap panel"; §5.5 folds approved roadmap items into the top rails as
advisor-selection cards. `wardrobe-panel.tsx` retains a "Request changes"
control, so a review affordance may partly survive, but with changed copy
and structure. Also fails earlier on a stale local `signIn` helper that
waits for a removed dashboard "Sign out" button. **Blocker: whether the
PHASE 4.9 / ADR-074 roadmap look-review flow (Love it / Maybe / Request
change + feedback rows) persists in V3 and where it now lives is a product
decision for the Wardrobe advisor-selection owner (20.17) / founder. This
test-only lane must not restore a removed panel to make it pass.**

## Net

2 of 4 owned specs reconciled (deleted). 2 remain red pending the two
blockers above. 20.19 stays unchecked.
