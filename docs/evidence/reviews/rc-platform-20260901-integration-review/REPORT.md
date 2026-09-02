# Independent Review — Release Candidate `rc/platform-20260901`

Independent review (pipeline step 11), 2026-09-02. Reviewer verified the
integration composition and re-ran the security-critical proofs directly rather
than trusting the proof agent's report.

- **Branch:** `rc/platform-20260901`
- **HEAD:** `24510d9b330c17fd1a469c39415735c15a7cb755`
- **Base:** `release-integration-lane-h` @ `ec84ac5`
- **Integrates:** V3 controller candidate `e17236b` (merge `2cb28da`) + global
  sign-out candidate `9a777cc` (merge `932a8ac`) + one evidence commit
  (`24510d9`).

## Verdict

# ACCEPT (as a release candidate, not yet mergeable to `main`)

The rc cleanly composes the two independently-security-reviewed **ACCEPT**
candidates with **zero merge conflicts**, introduces **no content beyond those
two candidates plus its own evidence**, passes every deterministic check
(lint/typecheck ×6, production build ×3, pgTAP 51/559/0), and adds **zero new
completion-validator failures**. Nothing here blocks continuing the pipeline.

It is **not** a merge-to-`main` release yet: `validate:completion` remains RED
on the pre-existing historical backlog and cannot fully enumerate (see §4), and
the newly-integrated items (R0.4, 20.6, 20.7, 20.17, 20.21) still lack
validator tranche records and PHASE.md checkbox updates (see §5). Those are the
next queued work items, not defects in this integration.

## 1. Composition — independently verified

- `git log release-integration-lane-h..HEAD` = the 2 merge commits + the V3
  controller's 35 commits (via `e17236b`) + the 3 sign-out commits
  (`e6ffd9f`/`cb49d94`/`9a777cc`) + `24510d9`. Nothing else.
- `git log HEAD --not e17236b feat/global-signout-20260901` = only `24510d9`,
  `932a8ac`, `2cb28da`, `ec84ac5` → the rc introduces **no new source content**
  beyond the two accepted candidates.
- `2cb28da` and `932a8ac` are both real merge commits (`Merge:` two parents
  each). `git grep` for conflict markers across `apps/**`, `packages/**`,
  `supabase/**` → **none**. `git diff 2cb28da^2 2cb28da` on sampled
  second-parent files (`apps/customer/app/r/[slug]/route.ts`, the 20.17
  migration) → **empty** → `e17236b` content is fully present, unmodified.
- **0 conflicts** confirmed. No conflict resolution occurred, so nothing could
  have been silently dropped.

## 2. Security-critical proofs — independently re-run

- `supabase test db supabase/tests/roadmap_approval_rls_test.sql supabase/tests/roadmap_gap_disposition_rls_test.sql`
  → **Files=2, Tests=44, 0 failed, Result: PASS.** The roadmap-approval RLS
  trigger fix and the new `wardrobe_roadmap_gap_dispositions` RLS surface both
  hold in the integrated tree.
- `packages/database/src/generated/database.types.ts` retains the
  schema-accurate hand-authored `wardrobe_roadmap_gap_dispositions` entry
  (6 references: Row/Insert/Update/Relationships). The proof agent's decision
  to revert the CLI-v2.115.0 regen (a 47 k-line pure-whitespace/`;` rewrite,
  no shape change) and keep the reviewed hand-authored entry is correct;
  `@paon/database` + `@paon/domain` typecheck green after.

## 3. Proof agent's results — spot-checked, consistent

`docs/evidence/runs/rc-platform-20260901/REPORT.md` (commit `24510d9`):
lint/typecheck 6/6 PASS, `supabase db reset` clean through `20260828185506` +
seed, pgTAP 51 files / 559 tests / 0 failed, production builds 3/3 exit 0, all
7 focused E2E specs ultimately green. The one recurring flake — the
"desktop global-scope sign-out" test in each of customer/retailer/admin,
failing its first cold-boot attempt on the post-revocation redirect and
passing on retry #1 — is a harness cold-start timing characteristic identical
across all three apps and is **not tied to either merged candidate**. The
`retries: 2` that absorbs it is the value each app's `playwright.config.ts`
already sets for CI. No stop-worthy regression.

## 4. `validate:completion` — RED, pre-existing, not a regression

`pnpm --filter @paon/domain validate:completion` exits 1 and **aborts with an
uncaught throw** at `docs/evidence/tranches/20.1.json` (`Completion evidence
missing applicability/evidence/ui`), so a full failing-item enumeration is not
obtainable. Everything emitted before the abort: `17.1, 17.3, 17.4, 17.5,
17.6, 17.8, 17.9, 17.14` (stale `browserProofRun` gitSha `b49bbb0`;
17.8/17.9 also run status `failed`) and `18.5` (stale gitSha `42e27d7`).

**Not a regression from this integration:**

- Both merge ranges (`ec84ac5..2cb28da`, `2cb28da..932a8ac`) touch **no**
  `docs/evidence/tranches/**` file, nor the validator
  (`validate-completion-evidence.ts`, last changed `eabc716`) or its parser
  (`completion-evidence.ts`, last changed `f3c928b`) — both ancestors of the
  merge base `ec84ac5`. The crash trigger `20.1.json` last changed `2527fcc`,
  also an ancestor.
- Every emitted failure is inside the known-failing set recorded in
  `docs/GROUND_TRUTH.md` §3 and in
  `docs/evidence/reviews/platform-reconciliation-20260901/REPORT.md` §3/§F4
  (that report lives on `agent/paon-reconciliation-20260901` @ `bba5930`, not
  on this branch).

**Follow-up owed (not blocking this rc):** the validator's uncaught throw on a
malformed tranche is itself a real robustness bug — it should report the
parse error and continue so the gate can enumerate every item. Tracked as a
validator-hardening task.

## 5. Newly-integrated items — impl present, proof green, tranches still owed

`ec84ac5` recorded completion _evidence_ for R0.4/20.6/20.17/20.21 without the
_implementation_ (reconciliation finding F1). This rc lands that
implementation via `e17236b`. State on rc HEAD:

| Item  | Impl on rc                | Flow proven green here                                                  | Validates     | Still needs                                                                                                           |
| ----- | ------------------------- | ----------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------- |
| R0.4  | yes (`c74bea2`)           | — (no focused spec in this sweep)                                       | no            | PHASE.md `[x]` + `docs/evidence/tranches/R0.4.json` + a connected browser proof run at current SHA                    |
| 20.6  | yes (`8c8be81`/`b6b6994`) | appointments wizard covered indirectly                                  | no            | `[x]` + `docs/evidence/tranches/20.6.json`                                                                            |
| 20.7  | yes                       | DFR first-run present                                                   | no            | `[x]` + `docs/evidence/tranches/20.7.json` + `runs/20.7*/evidence.json` SHA re-stamp                                  |
| 20.17 | yes (`1acc5d1`/`8c82025`) | **`wardrobe-removal-v3.spec.ts` PASS**                                  | no            | `[x]` + `docs/evidence/tranches/20.17.json`                                                                           |
| 20.21 | yes (`e1bad67`)           | **`storefront-digital-fitting-room-handoff-v3.spec.ts` PASS (4 tests)** | no            | `[x]` + `docs/evidence/tranches/20.21.json`                                                                           |
| 18.2  | yes                       | **`corporate-tender.spec.ts` PASS** incl. cross-tenant                  | no            | `[x]` + `docs/evidence/tranches/18.2.json`; `runs/18.2.json` gitSha is current                                        |
| 4.6   | yes (migration present)   | —                                                                       | indeterminate | `runs/4.6.json` re-stamp at current SHA (stale `42e27d7`); + the §4 validator abort fixed so the gate can evaluate it |

Creating these tranche records + checkbox updates is the immediate next
pipeline work (reconciliation report Group 1, tasks 4–9).

## 6. Hygiene

The rc worktree carried E2E byproducts (`apps/customer/tsconfig.json`
`.next-e2e-*` regression, `runs/18.2.json`, ~15 regenerated screenshots,
`apps/customer/.next-e2e-rc-3399/`) left unstaged by the proof run — reverted
/ removed by this review. The evidence commit `24510d9` contains exactly two
files (`REPORT.md` + `evidence.json`, 456 insertions). Nothing pushed; nothing
merged into `release-integration-lane-h` or `main`.

---

_Reviewed 2026-09-02. Composition verified with `git log`/`git diff`;
security pgTAP re-run directly. This report is the only file added by the
review._
