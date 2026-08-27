# Orders candidates review: fe91186 and b49798b

## Verdict

Reject current saved proof for both candidates. The code scopes are compatible,
but integration is conditional on the full dependency series and fresh
release-branch action and history proof.

## Dependency order

`4118202 -> 55e6d01 -> fe91186 -> 50bdf00 -> b49798b`

Neither candidate is an ancestor of the current release.

## Candidate check

| Candidate | Changed scope | Saved evidence SHA | Review finding |
| --- | --- | --- | --- |
| `fe91186` | Orders page, action-row E2E, 20.18 evidence | `55e6d01` | stale; spec asserts five hrefs but does not execute their success/failure paths |
| `b49798b` | history-integrity E2E and 20.27 evidence | `50bdf00` | stale; history assertion is substantive but must run on final release |

`fe91186` preserves a valid `productSlug` handoff to the existing Digital
Fitting Room. No reviewed path changes auth, RLS, migrations, Supabase,
storefront, QR, payment, or email.

## Required release-branch proof

```sh
pnpm --filter @paon/customer exec playwright test e2e/orders-actions-v3.spec.ts e2e/orders-v3-presentation.spec.ts e2e/orders-history-integrity-v3.spec.ts e2e/digital-fitting-room-first-run.spec.ts
pnpm --filter @paon/customer lint
pnpm --filter @paon/customer typecheck
```

Use authenticated desktop `1512x982` and mobile `390x844` flows. Exercise all
five order actions, including success/failure outcomes and the DFR productSlug
handoff; prove history placement and duplicate suppression; capture no-console-
error screenshots and evidence at the final release SHA.
