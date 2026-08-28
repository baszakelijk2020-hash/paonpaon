# Candidate 86e45d0 review

## Verdict

Reject. `86e45d0` alone is incomplete for Phase 20.19 and cannot establish
safe stale-E2E cleanup integration.

## Scope and dependency check

- Phase 20.19 depends on 20.13 and 20.17 and owns four stale specs plus 20.19
  evidence.
- `86e45d0` deletes only `roadmap-look-review.spec.ts` and
  `style-profile-account.spec.ts`.
- It is not a descendant of the candidate chain under review and has no 20.19
  evidence artifact.
- No reviewed file changes application code, migrations, auth, RLS, Supabase,
  storefront, QR, payment, or email.

## Completeness finding

The commit message implies four-spec cleanup, but the remaining two required
retargets occur only in immediate child `c1bf35c`, which is not an authorized
candidate for this review. Before any integration, a frontier decision must
explicitly authorize or reject `c1bf35c` as the required companion.

## Required release-branch proof if a complete authorized cleanup is supplied

```sh
pnpm --filter @paon/customer exec playwright test e2e/house-memory-fact-correction.spec.ts e2e/item-specific-complete-the-look.spec.ts e2e/account-v3-profile.spec.ts
pnpm --filter @paon/customer lint
pnpm --filter @paon/customer typecheck
```

Then capture authenticated V3 replacement flows with no console errors and
exact final-release-SHA evidence. Do not run deleted stale specs as acceptance
proof.

## Resolution — superseded by direct reconciliation (2026-08-27)

Phase 20.19 was reconciled directly on the release branch (commit `119e5a2`)
rather than by integrating candidate `86e45d0` (+ its unauthorized child
`c1bf35c`). Assessment of the four owned specs against release source:

- `style-profile-account.spec.ts`, `house-memory-fact-correction.spec.ts` —
  **deleted**. V3 §9 fully removes the /account StyleProfile and House Memory
  panels; `account/style-profile-panel.tsx`, `account/customer-facts-panel.tsx`
  and the `correctOwnCustomerFact` server action no longer exist
  (grep-confirmed). `account-v3-profile.spec.ts` already carries the
  V3-conformant "these surfaces are absent" assertions. (86e45d0 deleted only
  the first of these two.)
- `roadmap-look-review.spec.ts`, `item-specific-complete-the-look.spec.ts` —
  **recorded as blocked** in
  `docs/evidence/runs/20.19-customer-v3-stale-e2e/STATUS.md`: they target
  capabilities V3 relocated (roadmap items into rails as advisor-selection
  cards; item-specific Complete-the-Look into the owned-card `Actions +`
  deck), and retargeting them needs the V3 owned-card deck / advisor-selection
  wiring confirmed present by its owner (20.17 / 20.9) plus, for roadmap
  look-review, a founder decision on whether that flow persists.

Candidate `86e45d0` and `c1bf35c` are not needed. This review is complete:
verdict — do not integrate the candidate; 20.19 handled on-branch, partially,
with the remaining two specs precisely blocked.
