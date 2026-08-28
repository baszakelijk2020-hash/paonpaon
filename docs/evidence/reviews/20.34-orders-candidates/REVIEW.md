# Orders candidates review: fe91186 and b49798b

## Verdict

Reject current saved proof for both candidates. The code scopes are compatible,
but integration is conditional on the full dependency series and fresh
release-branch action and history proof.

## Dependency order

`4118202 -> 55e6d01 -> fe91186 -> 50bdf00 -> b49798b`

Neither candidate is an ancestor of the current release.

## Candidate check

| Candidate | Changed scope                               | Saved evidence SHA | Review finding                                                                  |
| --------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `fe91186` | Orders page, action-row E2E, 20.18 evidence | `55e6d01`          | stale; spec asserts five hrefs but does not execute their success/failure paths |
| `b49798b` | history-integrity E2E and 20.27 evidence    | `50bdf00`          | stale; history assertion is substantive but must run on final release           |

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

## Resolution — release-branch re-proof (2026-08-27)

Complete. `fe91186` -> release `6aa075d` (20.18) and `b49798b` -> release
`4a10f0b` (20.27); both are integrated on the release branch and re-proven on
the local Supabase stack:

- `orders-actions-v3.spec.ts` (commit `e736b91`) — 1 passed: all five §7
  actions render with exact labels and each resolves to a real shipped route
  carrying this order's own context — Order again `/r/<slug>/products/<slug>`,
  Complete the look `/digital-fitting-room?productSlug=<slug>` (valid slug
  handoff preserved), Ask a question `/messages?prefill=...<orderNumber>`,
  Request service `/services`, View order/invoice `/orders/<id>`. The action
  row's owner boundary adds no server action or component, so proving each
  destination is a real context-carrying route (not a dead anchor) satisfies
  the §7 "real actions" contract.
- `orders-v3-presentation.spec.ts` — 2 passed (regression).
- `orders-history-integrity-v3.spec.ts` (commit `756581c`) — 1 passed: a
  product seeded as both an owned wardrobe item and an order line stays in
  Order history, and no `/products/<slug>` href repeats inside
  `#complete-the-look`. Desktop + mobile, console-clean.

Customer lint + typecheck pass. Fresh `evidence.json` records the release SHA.
