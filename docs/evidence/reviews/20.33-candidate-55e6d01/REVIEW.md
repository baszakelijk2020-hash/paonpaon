# Candidate 55e6d01 review

## Verdict

Reject current saved proof. The Rewards implementation is conditionally safe
only after its parent `4118202` is accepted and fresh release proof exercises
real reward and referral controls.

## Scope and dependency check

- Parent: `4118202`; Phase 20.14 dependency: `20.2`.
- Changed files are limited to the loyalty page, focused loyalty E2E, and 20.14
  evidence screenshots/metadata.
- No application change touches auth, RLS, migrations, Supabase, storefront,
  QR, payment, or email.

## Saved-proof check

The 20.14 evidence records `4118202`, not implementation `55e6d01`, so it is
stale. Its focused spec checks the loyalty presentation and conditionally
clicks Join, but does not exercise a real referral or reward control as Phase
20.14 requires.

## Required release-branch proof

After integrating dependencies, run:

```sh
pnpm --filter @paon/customer exec playwright test e2e/loyalty-v3-presentation.spec.ts
pnpm --filter @paon/customer lint
pnpm --filter @paon/customer typecheck
```

Prove authenticated desktop `1512x982` and mobile `390x844` Rewards flows,
exercise Join plus a real reward/referral action with success/failure behavior,
capture clean-console screenshots, and record the final release SHA.

## Resolution — release-branch re-proof (2026-08-27)

Complete. Phase 20.14 is integrated on the release branch at `1923565` and
re-proven on the local Supabase stack (commit `ccbf9bc`):

- `loyalty-v3-presentation.spec.ts` — 1 passed: "Membership" kicker + exact
  "Rewards & Referrals" heading framing the real LoyaltyRepository engine
  (Badges shelf, Introduce a friend), no duplicate rewards surface, no House
  Memory copy, console-clean, desktop 1512x982 + mobile 390x844.
- `loyalty-badges.spec.ts` — 1 passed.
- `loyalty-referrals.spec.ts` — 1 passed: exercises the **real** Join
  ("Join loyalty programme" click), Send invitation, the referral state
  machine (Invited -> Signed up -> Reward issued), a real +500 referral-points
  DB delta on `loyalty_accounts`, and a real reward redemption through the
  customer Redeem form (a `reward_redemptions` row is created and the balance
  drops by the reward's `points_cost`). This closes the review's finding that
  the presentation spec alone "does not exercise a real referral or reward
  control".

Customer lint + typecheck pass. Fresh `evidence.json` records the release SHA.
