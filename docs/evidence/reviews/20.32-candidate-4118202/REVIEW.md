# Candidate 4118202 review

## Verdict

Reject as a standalone integration candidate. It is Profile-only and its saved
proof is stale. The dependent Overview, Orders, Profile series can be safely
re-proven only after deliberate integration in this order:

`3325ee0 -> a256373 -> 38a99dd -> 4118202`.

## Scope and dependency check

- `4118202` parent: `38a99dd`; merge base with the release is `63ec387`.
- It changes only Profile paths: `account/actions.ts`, removed Profile panels,
  `account-v3-profile.spec.ts`, and 20.13 evidence.
- Orders belongs to `a256373`; Overview belongs to `38a99dd`. Neither is
  included by cherry-picking `4118202` alone.
- No candidate path changes auth, RLS, migrations, Supabase, storefront, QR,
  payment, or email.

## Saved-proof freshness

| Slice | Implementation | Saved evidence SHA | Disposition |
| --- | --- | --- | --- |
| Overview 20.11 | `38a99dd` | `a256373` | stale and records a failed Morning Routine regression |
| Orders 20.12 | `a256373` | `3325ee0` | stale |
| Profile 20.13 | `4118202` | `38a99dd` | stale |

Later stale-E2E cleanup is also required: the current release retains specs
that assert removed Profile UI.

## Required release-branch proof

After integrating the complete dependency series, run:

```sh
pnpm --filter @paon/customer exec playwright test e2e/dashboard-v3-daily-return.spec.ts e2e/dashboard-morning-routine-hero.spec.ts e2e/orders-v3-presentation.spec.ts e2e/account-v3-profile.spec.ts
pnpm --filter @paon/customer lint
pnpm --filter @paon/customer typecheck
```

Then prove authenticated Isabelle desktop `1512x982` and mobile `390x844`
flows for `/dashboard`, `/orders`, `/orders/:id`, and `/account`, with clean
console output and evidence naming the final release SHA.
