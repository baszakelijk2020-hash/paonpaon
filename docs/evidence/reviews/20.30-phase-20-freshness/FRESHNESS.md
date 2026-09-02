# Phase 20.30 — Phase 20 evidence freshness

| Item  | Recorded SHA | Status                                        | Required rerun                                                     |
| ----- | ------------ | --------------------------------------------- | ------------------------------------------------------------------ |
| 20.11 | `38a99dd`    | stale versus `4118202` batch                  | dashboard V3 focused E2E, lint, typecheck, desktop/mobile proof    |
| 20.12 | `a256373`    | stale versus `4118202` batch                  | Orders focused E2E, lint, typecheck, desktop/mobile proof          |
| 20.13 | `3325ee0`    | stale versus `4118202` batch                  | account Profile focused E2E, lint, typecheck, desktop/mobile proof |
| 20.21 | `5a087e0`    | fresh on candidate, unverified on integration | storefront DFR handoff E2E, lint, typecheck, desktop/mobile proof  |

All reruns must record the accepted final integration SHA. No stale evidence
may be represented as final release proof.

## Resolution (2026-08-27)

The three `4118202`-batch rows are reconciled: 20.11 / 20.12 / 20.13 have been
re-proven against the release branch on the local Supabase stack with fresh
`evidence.json` + screenshots recording the release SHA (commit `98c3a64`;
audit in `13e9765`). 20.7, 20.9, 20.14, 20.18, 20.20, 20.27 were likewise
found to carry stale candidate SHAs and have each been re-proven and refreshed
(commits `ddf84e9`, `2353a50`, `ccbf9bc`, `e736b91`, `263421b`, `756581c`).

The 20.21 row remains open: candidate `5a087e0` (raw-PDP DFR handoff) is not
integrated on this release branch, so there is nothing to re-prove yet — it
stays a Phase 20.21 implementation item, not a freshness gap.
