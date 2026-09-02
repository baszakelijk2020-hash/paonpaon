# RC Platform 20260901 — Remaining Work Ledger

rc HEAD `ebb1220` on `rc/platform-20260901`. Nothing pushed; nothing merged to
`release-integration-lane-h` or `main`.

## Verified & done

| Item                                                                                                                      | Result                                                                                                                                | Commit(s)                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| V3 controller `e17236b` security review                                                                                   | **ACCEPT**                                                                                                                            | `8b204d9` (branch `review/v3-controller-security-20260901`) |
| Global sign-out — customer/retailer/admin, GLOBAL scope, AppShell dual-mount fix, cross-context 200→400 revocation proven | shipped, all specs green                                                                                                              | `e6ffd9f`/`cb49d94` on `feat/global-signout-20260901`       |
| Global sign-out security review                                                                                           | **ACCEPT**                                                                                                                            | `9a777cc`                                                   |
| Integrate V3 controller into rc                                                                                           | merge, **0 conflicts**                                                                                                                | `2cb28da`                                                   |
| Integrate global sign-out into rc                                                                                         | merge, **0 conflicts**                                                                                                                | `932a8ac`                                                   |
| `database.types.ts` regen                                                                                                 | CLI v2.115 regen = whole-file whitespace churn → kept schema-accurate hand-authored entry                                             | —                                                           |
| Migrations + pgTAP                                                                                                        | `db reset` clean through `20260828185506`; pgTAP **51 files / 559 tests / 0 fail**; RLS-critical files re-run independently 44/44     | —                                                           |
| 3-app lint / typecheck / prod build / focused E2E                                                                         | 6/6 lint+typecheck, 3/3 builds, all focused specs green                                                                               | `24510d9`                                                   |
| Independent rc integration review                                                                                         | **ACCEPT** (rc-level; not yet main-mergeable)                                                                                         | `4baf537`                                                   |
| Convert 6 non-conforming Stage-20/21 tranches to structured schema                                                        | validator no longer aborts                                                                                                            | `256622c`                                                   |
| **20.17** advisor-selection removal                                                                                       | spec 2/2 green at rc HEAD; path-verified run + tranche; **PHASE.md `[x]`; validates clean**                                           | `6c531f9`, `ebb1220`                                        |
| **20.21** raw-PDP → DFR handoff                                                                                           | spec 4/4 green at rc HEAD; path-verified run + tranche **validates clean**; checkbox held `[ ]` — dependency **20.7** not yet checked | `6c531f9`, `ebb1220`                                        |

## `validate:completion` residual at rc HEAD `ebb1220` — 42 items, ALL pre-existing

The validator runs to completion (exit 1). None of these were introduced by
the V3-controller + global-sign-out integration (verified: both merge ranges
touch no `docs/evidence/tranches/**`, no validator/parser source). `20.17` and
`20.21` do **not** appear in the failure output.

### Group R1 — Stage-20/21 checked `[x]` items with NO tranche file (21)

`20.9, 20.11, 20.12, 20.13, 20.14, 20.15, 20.18, 20.20, 20.22, 20.23, 20.24,
20.25, 20.26, 20.27, 20.28, 20.30, 20.32, 20.33, 20.34, 20.36, 21.1`
**Recipe per item:** (a) identify the covering `apps/customer/e2e/<x>-v3.spec.ts`
(verify against the spec's own `describe` text); (b) re-run it at rc HEAD
against local Supabase; (c) on green, write `docs/evidence/runs/<id>.json`
`{phaseItemId, gitSha:<HEAD>, spec:<path>, status:"passed", timestamp}`; (d)
write `docs/evidence/tranches/<id>.json` in the structured schema — **every
`evidence.*` string must cite a file that exists at HEAD** (grep first; the
earlier delegated sweep fabricated paths and was reset), every `n_a` field
needs a non-empty explanatory note, `browserProofSpec` == the run `spec`,
`linkedSeedId: "e2e-customer-workspace"`, `status: "verified_local"`.
20.28/20.30/20.32/20.33/20.34/20.36/21.1 are review/deferral items — author
with `applicability.browser:"n_a"` + `browserProofSpec:""`, citing the
`docs/evidence/reviews/` artifact or the PHASE.md deferral rationale.
Known map: 20.9→`wardrobe-v3-presentation`, 20.11→`dashboard-v3-daily-return`,
20.12→`orders-v3-presentation`, 20.13→`account-v3-profile`,
20.14→`loyalty-v3-presentation`, 20.15→`customer-navigation-v3-copy`
(**currently RED — genuine console 400, needs debugging first**),
20.18→`orders-actions-v3`, 20.20→`appointments-alteration-choices-v3`,
20.22→`wardrobe-no-external-entry-v3`, 20.23→`storefront-dashboard-return-state-v3`,
20.24→`customer-prefetch-constrained-network-v3`, 20.25→`customer-cta-squircle-v3`,
20.26→`wardrobe-rail-contract-v3`, 20.27→`orders-history-integrity-v3`.

### Group R2 — stale `browserProofRun.gitSha` on `[x]` items (needs covering spec re-run + run-file re-stamp)

- `b49bbb0`: **17.1, 17.3, 17.4, 17.5, 17.6, 17.14, 8.4, 9.1**
- `b49bbb0` + run `status:"failed"`: **17.8, 17.9, 8.4** — these fail on the
  retailer academy sign-out harness; the retailer/admin sign-out is now fixed
  in this rc, so re-running `academy-roleplay*.spec.ts` / `completion-harness.spec.ts`
  at rc HEAD should flip them green.
- `42e27d7`: **18.5**

### Group R3 — schema-converted V3 arch items, `[x]`, stale run SHA / spec mismatch (6)

`20.1, 20.2, 20.3, 20.4, 21.2, 21.6` — `20.1`/`20.4` also have run `spec` ≠
`browserProofSpec` (pointed at a browser spec for traceability; the run is a
fleet/inventory artifact). Re-run each item's real covering spec
(`customer-navigation-performance`, `atelier-demo-baseline`, `21.2`/`21.6` seam
specs) at rc HEAD; re-stamp the run file; align `browserProofSpec`.

### Group R4 — VWS path citations obsolete (files moved to `digital-fitting-room/`) (4)

`4.6, 4.7, 4.9, 4.10` — stale run gitSha `42e27d7` **and** `evidence.*` cite
deleted paths (`wardrobe/virtual-studio-*.tsx`, `account/style-portrait-*.tsx`,
`wardrobe/roadmap-panel.tsx`, `e2e/roadmap-look-review.spec.ts`). Update
citations to current locations under `apps/customer/app/(dashboard)/digital-fitting-room/`
and `.../wardrobe/`, re-run `virtual-studio.spec.ts` / `digital-fitting-room-*.spec.ts`,
re-stamp.

### Group R5 — genuine failures needing debugging (2)

- **20.15** `customer-navigation-v3-copy.spec.ts` — console "400 Bad Request"
  on navigation. Not a flake. Needs root-cause (which request 400s, why).
- **R0.4** `apps/retailer/e2e/house-memory-advisor-today.spec.ts` — 1/3;
  fails on a "Permission test opportunity" fixture not found. Looks like a
  test-data/seed gap in the spec that shipped with `e17236b`, not product
  code. Needs the fixture setup fixed, then re-run + tranche + `[x]`.

## Explicit blockers (not actionable in this pipeline)

- **`apps/customer/tsconfig.json` `.next-e2e-*` regression** — in the PROTECTED
  checkout `/Users/nguyen/Projects/PAON`, off-limits. Left for the founder.
- **Supabase CLI v2.115.0 vs v2.116.0** — `supabase gen types` emits whole-file
  whitespace churn; `database.types.ts` stays hand-authored until the CLI is bumped.
- **`validate:completion` robustness** — `parseCompletionEvidenceRecord`
  (`packages/domain/src/programme/completion-evidence.ts:420`) throws uncaught
  on a malformed tranche instead of recording a failure. Worked around here by
  fixing the 6 tranches; the crash path itself should be hardened.
- Platform-reconciliation report §4.7 BLK set: Stage 6.2/6.3 commerce, 12.1
  measurement scope, 14.1 corporate-portal auth, ADR-050/072, provider keys.

## Path to `main`

`rc/platform-20260901` is a **verified, independently-reviewed integration** of
the two accepted candidates. It is **not** merge-to-`main` ready until Groups
R1–R5 are green or each residual is an explicit documented blocker. Sequence:
R5 (debug) → R1 (biggest, mechanical-but-careful) → R2 → R3 → R4 → re-run
`validate:completion` → if green (or all-blocked-documented), open the
`rc/platform-20260901` → `main` PR with a full green proof.
