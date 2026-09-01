# Phase 20.19 — stale V3 E2E reconciliation

- **Branch:** `agent/c2-roadmap-approval-rls` (base `release-integration-lane-h` @ `ee33970`).
  **Not merged into release.**
- **Owned specs:** `house-memory-fact-correction.spec.ts`,
  `style-profile-account.spec.ts`, `item-specific-complete-the-look.spec.ts`,
  `roadmap-look-review.spec.ts` — plus this evidence directory.
- **Owner boundary:** reconcile only assertions that require UI V3
  explicitly removed. Do not restore removed UI to pass a test. Replace
  only with V3-conformant assertions; preserve useful regression coverage.

All four were failing on the release branch against local Supabase. Final
disposition:

## `house-memory-fact-correction.spec.ts` — DELETED (commit `88c73a8`, earlier)

Asserted a `/account` "House Memory" heading and fact-correction flow.
V3 §9 removes the customer-facing House Memory panel and all House Memory
copy; `correctOwnCustomerFact` / `account/customer-facts-panel.tsx` no
longer exist. The V3-conformant assertion (`getByText(/house memory/i)`
count 0) already lives in `account-v3-profile.spec.ts`; table-level RLS is
covered by pgTAP. Nothing left to drive.

## `style-profile-account.spec.ts` — DELETED (commit `88c73a8`, earlier)

Asserted a `/account` StyleProfile panel ("Relaxed tailoring",
"Confidence N%", "Remove inference"). V3 §9 removes style-discovery /
Style Portrait from Profile; `account/style-profile-panel.tsx` /
`style-profile-actions.ts` no longer exist. `account-v3-profile.spec.ts`
already asserts their absence. Pure superseded dead weight.

## `item-specific-complete-the-look.spec.ts` — RETARGETED (this commit)

The capability is **not removed** — V3 §5.4 relocates item-specific
"Complete the look" from a card-face `[data-item-complete-the-look]`
disclosure to the first entry of the owned card's `Actions +` progressive
deck. The scoping is still item-specific
(`item-specific-complete-the-look-data.ts` →
`selectItemSpecificCompleteTheLookSuggestions`), and the tile's
"See it on me" still runs `generateSuggestedLookTryOn` → an outfit titled
`See it on me: <name>` + a real `wardrobe_visualization_jobs` row via
`enqueueLook` (unchanged).

Changes — stale UI navigation only; every fixture, DB postcondition, and
cleanup assertion is preserved verbatim:

- `signIn` helper: the removed dashboard "Sign out" button check →
  `page.locator("[data-customer-shell]").isVisible()` (the real V3
  authenticated-shell marker, the same one `roadmap-approval-rls-v3.spec.ts`
  and `wardrobe-removal-v3.spec.ts` use).
- `card.locator("[data-item-complete-the-look]")` + `summary` click →
  `card.getByRole("button", { name: "Actions +" }).click()` then
  `card.getByRole("button", { name: "Complete the look" }).click()`.
- The suggestion tile / "See it on me" click and the two DB polls
  (`outfits.title = "See it on me: E2E Item-Specific CTL Trousers"`, then a
  `wardrobe_visualization_jobs` row for that outfit) are unchanged — that
  is the useful regression coverage this spec exists for.

## `roadmap-look-review.spec.ts` — DELETED (this commit)

Drove a **standalone roadmap panel on `/wardrobe`** (`li` containing the
roadmap title, with Love it / Maybe / Request change writing
`wardrobe_visualization_feedback` rows). V3 §5.1 removes the standalone
roadmap panel; §5.5 folds approved roadmap items into the top rails as
advisor-selection cards — which carry Buy / Discuss with advisor / Proceed
in store / Explore alternatives / Remove from wardrobe plan, and **no**
per-look image review. There is no V3 surface on `/wardrobe` to retarget
to, and restoring the removed panel to pass the test is out of bounds.

The `wardrobe_visualization_feedback` write path (Love it / Not for me /
maybe signals on a real `ready` job) is fully covered by current V3 specs:

- `apps/customer/e2e/digital-fitting-room-supported-actions-proof-v3.spec.ts`
  — "Love it" writes a real feedback row.
- `apps/customer/e2e/virtual-studio-batch-and-feedback-evidence.spec.ts`
  — "Love it" then "Not for me" flips the feedback row.
- `supabase/tests/wardrobe_visualization_enqueue_test.sql` — table RLS.

Same disposition as the two specs already deleted in `88c73a8`: the surface
is gone, the capability + RLS are proven elsewhere.

## Net

**4 / 4 owned specs reconciled** — 2 deleted earlier (`88c73a8`), 1
retargeted to the V3 `Actions +` deck, 1 deleted (surface removed by
V3 §5.1, coverage preserved elsewhere). No removed UI was restored. No
application code changed.

## Verification (this commit)

| Step                                                        | Result                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @paon/customer lint`                         | clean                                                                                                                                                                                                                                                                                                                                                      |
| `pnpm --filter @paon/customer typecheck`                    | clean                                                                                                                                                                                                                                                                                                                                                      |
| `apps/customer/e2e/item-specific-complete-the-look.spec.ts` | **1 passed** (`PAON_E2E_PORT=3333`, `PAON_NEXT_DIST_DIR=.next-e2e-2019-3333`, `PAON_E2E_WEBSERVER_TIMEOUT_MS=420000`) — card renders, `Actions +` deck opens, "Complete the look" shows the item-specific trousers suggestion, "See it on me" creates the `See it on me: E2E Item-Specific CTL Trousers` outfit + a real `wardrobe_visualization_jobs` row |

No existing `.next-e2e-*` directory was deleted. Exclusive local
Supabase / Playwright access held via the `/tmp/paon-v3-integration-resources.lock`
live-PID lock for the run.
