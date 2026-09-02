# PHASE 20.22 — claude-wardrobe-external-write-removal-v3 — remove dormant external garment write path

No `docs/PHASE.md` prose entry exists for this task number (queued ahead of
documentation, same pattern as several sibling tasks this session).

## What was removed

`apps/customer/app/(dashboard)/wardrobe/actions.ts` exported a Server Action
`addExternalWardrobeItem` letting a customer manually create a wardrobe
garment entry from an external/non-order source. Removed, along with its
now-unused `createExternalWardrobeItemInputSchema` import.

Product forbids this entirely:
`docs/plans/CUSTOMER_ENVIRONMENT_REBUILD_V3.md:15` — "No external garments
exist in the customer wardrobe UI. Do not show an add-external-garment form,
external-garment card, external provenance, or bought-elsewhere workflow."
`docs/PHASE.md:8192` similarly restricts wardrobe items to
"retailer purchase-linked garments; do not add external garments."

## Frontier note on this lane's prior state

This lane's branch already contains substantial prior wardrobe-rebuild work
(commits `30474bf`, `430a97b`, `d9517c8`, `7020045`, `0b56d26`, none from
this session) that had already removed the "Add an external garment" form
from `wardrobe-panel.tsx`/`page.tsx` in an earlier pass — confirmed directly:
neither file references `addExternalWardrobeItem` or any external-garment
copy on this branch. So on this branch, removing the Server Action from
`actions.ts` is fully isolated dead-code cleanup with **no collateral edits
needed** to any other file.

A first delegated worker attempt (dispatched to a fresh isolated worktree)
started from an older base (`origin/main` at `826f5fb`, ~189 commits behind
this lane) where the form was still present, and made now-inapplicable
collateral edits to `wardrobe-panel.tsx`/`page.tsx` plus a spec that
authenticated with `TEST_CUSTOMER_EMAIL` (`e2e-shopper@paon.test`) — a
`.test`-TLD address that `apps/customer/e2e/fixtures.ts` itself documents as
rejected by Supabase Auth for magic-link calls, which would have made that
spec unreliable. That commit was not merged; the frontier re-applied only
the isolable `actions.ts` removal directly against this branch's current
state and wrote a fresh e2e spec using the proven `seedDemoData` +
`contact+isabelle@nebelspiegel.com` magic-link pattern used by every other
spec in this lane this session.

`WardrobeRepository.createExternalItem()` (the underlying `@paon/database`
repository method) is untouched — it remains legitimately used by advisor-side
code (`createAdvisorExternalItem`) and by six existing e2e fixture files that
call it directly, bypassing the now-removed customer-facing Server Action
entirely (confirmed via direct import-line inspection before editing).

## Commit

`apps/customer/app/(dashboard)/wardrobe/actions.ts` (edited),
`apps/customer/e2e/wardrobe-no-external-entry-v3.spec.ts` (new).

## Verification

- `pnpm --filter @paon/customer lint` — pass, no warnings/errors.
- `pnpm --filter @paon/customer typecheck` — pass, no errors.
- `pnpm exec playwright test wardrobe-no-external-entry-v3.spec.ts` (from
  `apps/customer/`) — 1/1 passed (6.2s). Asserts no external-garment
  form/button/copy anywhere on `/wardrobe`, and that the real eight
  always-rendered rails (`[data-wardrobe-rail]`) are still present.
- Regression check: `pnpm exec playwright test wardrobe.spec.ts` — 3/3
  passed, confirming the six fixture files' direct
  `WardrobeRepository.createExternalItem()` usage is unaffected.

## Release integration verification

The customer-facing removal is integrated at release code commit `e9d52e0`.
On that release code, the isolated local-Supabase run of
`wardrobe-no-external-entry-v3.spec.ts` passed 1/1, followed by customer lint
and customer typecheck with no errors. The test authenticated as the canonical
customer demo persona and proved both the absence of every external-garment
entry affordance and the presence of all eight real wardrobe rails.
