# RC Platform 20260901 — Remaining Work Ledger

Snapshot after pipeline steps 1–12 (first pass), rc HEAD `256622c` on
`rc/platform-20260901`. Nothing pushed; nothing merged to
`release-integration-lane-h` or `main`.

## Done

| #   | Item                                                                                            | Result                                                                                                                                   | Commit                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| —   | V3 controller `e17236b` security review                                                         | ACCEPT                                                                                                                                   | `8b204d9` (branch `review/v3-controller-security-20260901`)              |
| —   | Global sign-out implementation (customer/retailer/admin, GLOBAL scope, AppShell dual-mount fix) | shipped, all specs green, cross-context 200→400 revocation proven                                                                        | `e6ffd9f` (src) / `cb49d94` (evidence) on `feat/global-signout-20260901` |
| 1   | Sign-out security review                                                                        | ACCEPT                                                                                                                                   | `9a777cc`                                                                |
| 2   | rc worktree from `release-integration-lane-h` @ `ec84ac5`                                       | `rc/platform-20260901`                                                                                                                   | —                                                                        |
| 3   | Integrate V3 controller                                                                         | merge, 0 conflicts                                                                                                                       | `2cb28da`                                                                |
| 4   | Integrate global sign-out                                                                       | merge, 0 conflicts                                                                                                                       | `932a8ac`                                                                |
| 5   | Conflict resolution                                                                             | none needed                                                                                                                              | —                                                                        |
| 6   | Regenerate `database.types.ts`                                                                  | CLI v2.115 regen = whole-file whitespace churn only → kept schema-accurate hand-authored entry (has `wardrobe_roadmap_gap_dispositions`) | —                                                                        |
| 7   | Migrations + pgTAP                                                                              | `db reset` clean through `20260828185506`; pgTAP **51 files / 559 tests / 0 fail**; 2 RLS-critical files re-run independently 44/44      | —                                                                        |
| 8   | 3-app lint/typecheck/build/E2E                                                                  | 6/6 lint+typecheck, 3/3 prod builds, all focused specs green (cold-start sign-out flake retries clean, not candidate-related)            | `24510d9` (evidence)                                                     |
| 9   | `validate:completion`                                                                           | see backlog below                                                                                                                        | —                                                                        |
| 10  | Evidence commit                                                                                 |                                                                                                                                          | `24510d9`                                                                |
| 11  | Independent rc review                                                                           | ACCEPT (rc-level; not yet mergeable to `main`)                                                                                           | `4baf537`                                                                |
| 12  | Convert 6 non-conforming Stage-20/21 tranches to structured schema                              | validator no longer aborts; full backlog now enumerable                                                                                  | `256622c`                                                                |

## `validate:completion` full backlog at rc HEAD `256622c` (exit 1)

The validator now runs to completion (no uncaught throw). Remaining failures —
all **pre-existing**, none introduced by this integration:

### A. Stale `browserProofRun.gitSha` (needs the covering spec re-run at a current SHA)

- `b49bbb0`: **17.1, 17.3, 17.4, 17.5, 17.6, 17.14, 8.4, 9.1**
- `b49bbb0` + run `status: failed`: **17.8, 17.9, 8.4** (17.8/17.9 fail on the still-open cross-app sign-out issue in the _retailer academy_ harness — the global-sign-out fix in this rc replaces the customer control and the retailer/admin controls; re-run these specs here to confirm)
- `42e27d7`: **18.5, 4.6, 4.7, 4.9, 4.10**
- V3 items `20.1, 20.2, 20.3, 20.4, 21.2, 21.6` — stale gitSha; `20.1`/`20.4` also have `browserProofSpec` ≠ run `spec` (architecture/inventory items pointed at a browser spec for traceability)

### B. Referenced artifact path does not exist (VWS files moved to `digital-fitting-room/`)

- `4.10`: `apps/customer/app/(dashboard)/wardrobe/virtual-studio-actions.ts`, `…/virtual-studio-panel.tsx`
- `4.7`: `…/account/style-portrait-panel.tsx`, `…/account/style-portrait-actions.ts`, `…/wardrobe/virtual-studio-panel.tsx`, `…/wardrobe/virtual-studio-actions.ts`
- `4.9`: `…/wardrobe/roadmap-panel.tsx`, `apps/customer/e2e/roadmap-look-review.spec.ts` (spec deleted by `e17236b`'s `47928ac`)
  → these tranches' `evidence.*` path citations need updating to the current file locations.

### C. Checked PHASE items with NO tranche file at all (21 items)

`20.9, 20.11, 20.12, 20.13, 20.14, 20.15, 20.18, 20.20, 20.22, 20.23, 20.24, 20.25, 20.26, 20.27, 20.28, 20.30, 20.32, 20.33, 20.34, 20.36, 21.1`
→ most have a real `*-v3.spec.ts` and a `docs/evidence/runs/20.xx-*/` dir already; need a structured `docs/evidence/tranches/<id>.json` authored + (where the run SHA is stale) the spec re-run at rc HEAD.

### D. Newly-integrated V3 items — impl present + flow proven green here, tranche + checkbox still owed

- **20.17** (`wardrobe-removal-v3.spec.ts` PASS) — needs `tranches/20.17.json` + PHASE.md `[x]` + `runs/20.17*/evidence.json` SHA re-stamp
- **20.21** (`storefront-digital-fitting-room-handoff-v3.spec.ts` PASS, 4 tests) — needs `tranches/20.21.json` + `[x]` + re-stamp
- **20.6** (`appointments-booking-wizard-v3.spec.ts` / `appointments-audit-v3.spec.ts`) — re-run at rc HEAD, then tranche + `[x]`
- **20.7** (`digital-fitting-room-first-run.spec.ts`) — re-run, tranche + `[x]`, `runs/20.7*` re-stamp
- **18.2** (`corporate-tender.spec.ts` PASS incl. cross-tenant; `runs/18.2.json` gitSha already current) — needs `tranches/18.2.json` + `[x]`
- **R0.4** — impl `c74bea2` present; needs a connected advisor Today→House Memory browser proof at rc HEAD, then `tranches/R0.4.json` + `[x]`

## Explicit blockers (not actionable in this pipeline)

- **`apps/customer/tsconfig.json` `.next-e2e-*` regression** — lives in the PROTECTED checkout `/Users/nguyen/Projects/PAON`, off-limits. Left for the founder. (reconciliation report §7 task 1)
- **Supabase CLI v2.115.0 vs v2.116.0** — `supabase gen types` emits whole-file whitespace churn; `database.types.ts` stays hand-authored until the CLI is bumped.
- **Validator hardening** — `parseCompletionEvidenceRecord` throws (uncaught) on a malformed tranche instead of recording it as a failure; worked around here by fixing the 6 tranches, but the crash path itself should be made resilient. (`packages/domain/src/programme/completion-evidence.ts:420`)
- Anything in the platform-reconciliation report §4.7 marked BLK (parked / founder-decision / external credential): Stage 6.2/6.3 commerce, 12.1 measurement scope, 14.1 corporate-portal auth, ADR-050/072, provider keys, etc.

## Next actions (dependency order)

1. **V3 evidence sweep** (backlog C + D): for each checked Stage-20/21 item, re-run its covering `*-v3.spec.ts` at rc HEAD against local Supabase; on green, write `runs/<id>.json` (gitSha=HEAD, status=passed) + structured `tranches/<id>.json` (status `verified_local`, truthful applicability/evidence/uiChecklist, `browserProofSpec` == run spec). Then set the PHASE.md `[x]` for 20.17/20.21/20.6/20.7/18.2/R0.4.
2. **Stale-SHA re-proof** (backlog A): re-run 17.1/17.3–17.6/17.8/17.9/17.14/8.4/9.1/18.5 covering specs at rc HEAD; re-stamp runs. 17.8/17.9/8.4 depend on the retailer/admin sign-out working — now fixed in this rc, so confirm.
3. **Path-citation fixes** (backlog B): update 4.6/4.7/4.9/4.10 tranche `evidence.*` file paths to current locations; re-run VWS specs; re-stamp.
4. Re-run `validate:completion` — capture the residual; every remaining red item is then either genuinely unbuilt (→ implement per reconciliation §6 queue) or explicitly blocked (→ record with evidence).
5. Only once `validate:completion` is green (or every red item is an explicit documented blocker): open the `rc/platform-20260901` → `main` PR path.
