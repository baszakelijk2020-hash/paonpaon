# RC Platform 20260901 — Integration Proof

**Branch:** `rc/platform-20260901`
**HEAD at proof time:** `932a8ac4e5b47e185ff07cd48aace4c0aa6a56cb`
**Proved:** 2026-09-02
**Tooling:** Node v22.20.0 · Supabase CLI v2.115.0 (v2.116.0 available)

This run proves an **already-integrated** release candidate. The two integration
merges were performed, security-reviewed **ACCEPT**, and committed earlier. They
were **not** redone here. This is steps 6-10 of the RC checklist: install,
verify, prove, then commit the evidence.

## Merges under proof (pre-existing, 0 conflicts each)

| Merge commit | Subject                                                           | Candidate | Parents              | Conflicts |
| ------------ | ----------------------------------------------------------------- | --------- | -------------------- | --------- |
| `2cb28da`    | merge(rc): integrate V3 controller candidate e17236b (accepted)   | `e17236b` | `ec84ac5`, `e17236b` | 0         |
| `932a8ac`    | merge(rc): integrate global sign-out candidate 9a777cc (accepted) | `9a777cc` | `2cb28da`, `9a777cc` | 0         |

Working tree clean at start and after `pnpm install`.

## 1. Install

`pnpm install` - lockfile up to date, "Already up to date", exit 0.
`git status --porcelain` clean afterwards. **PASS**

## 2. Per-app lint + typecheck

| Package          | `lint` (eslint --max-warnings 0) | `typecheck` (tsc --noEmit) |
| ---------------- | -------------------------------- | -------------------------- |
| `@paon/customer` | PASS                             | PASS                       |
| `@paon/retailer` | PASS                             | PASS                       |
| `@paon/admin`    | PASS                             | PASS                       |
| `@paon/database` | PASS                             | PASS                       |
| `@paon/domain`   | PASS                             | PASS                       |
| `@paon/ui`       | PASS                             | PASS                       |

All 12 invocations exit 0.

## 3. DB reset + `database.types.ts` regen check

**`supabase db reset`** - exit 0. Last migration applied:
`20260828185506_add_wardrobe_roadmap_gap_dispositions.sql`, then
`Seeding data from supabase/seed.sql`, then `Reset local database.` **PASS**

**Type regen** - `pnpm --filter @paon/database run generate-types`
(`supabase gen types typescript --local`) ran, exit 0.

- `git diff --stat` -> `packages/database/src/generated/database.types.ts`,
  **47221 lines, 23633 insertions / 23588 deletions** - whole file rewritten.
- **Nature of the diff:** every changed line is trailing-semicolon removal /
  whitespace. No schema or type-shape difference. Installed CLI v2.115.0 emits
  semicolon-less type members; the committed hand-authored file uses `;`.
- **CLI mismatch:** `supabase` reports v2.115.0 installed, v2.116.0 available.
- **Decision - case (c):** huge unrelated CLI-version churn.
  `git checkout -- packages/database/src/generated/database.types.ts`; kept the
  hand-authored (reviewed schema-accurate) entry. Verified it already contains
  the `wardrobe_roadmap_gap_dispositions` table shape
  (Row/Insert/Update/Relationships, 6 references).
- **After revert:** tree clean. `@paon/database typecheck` exit 0,
  `@paon/domain typecheck` exit 0. **GREEN.**

`database.types.ts` **not changed** in this RC.

## 4. pgTAP - `supabase test db`

```
Files=51, Tests=559,  0 failed
Result: PASS
```

Failing files: **none**.
`roadmap_approval_rls_test.sql` -> **ok**.
`roadmap_gap_disposition_rls_test.sql` -> **ok**.

## 5. Per-app production build

| App                    | Result                                        |
| ---------------------- | --------------------------------------------- |
| `@paon/customer build` | PASS (exit 0, route table printed, no errors) |
| `@paon/retailer build` | PASS (exit 0, no errors)                      |
| `@paon/admin build`    | PASS (exit 0, no errors)                      |

No warnings surfaced.

## 6. Focused E2E (`--retries=2`, ports 3000/3001/3002/3399 cleared before each app)

### customer - `PAON_E2E_PORT=3399 PAON_NEXT_DIST_DIR=.next-e2e-rc-3399`

**11 passed, 1 flaky, 0 failed (2.5m)**

| Spec                                                     | Result                                                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/customer-signout-v3.spec.ts`                        | PASS - desktop global-scope test flaky (attempt 1 failed in the `signInFreshContext` helper on a magic-link race -> `login?error=invalid_invite`; passed retry #1). Mobile + other desktop tests passed clean. |
| `e2e/wardrobe-removal-v3.spec.ts`                        | PASS (desktop + mobile)                                                                                                                                                                                        |
| `e2e/storefront-digital-fitting-room-handoff-v3.spec.ts` | PASS (4 tests: desktop, mobile, product-nav, category-filter)                                                                                                                                                  |
| `e2e/roadmap-approval-rls-v3.spec.ts`                    | PASS (4 tests: approve + request-changes, desktop + mobile)                                                                                                                                                    |

### retailer

**3 passed, 2 flaky, 0 failed (47.7s)**

| Spec                              | Result                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `e2e/retailer-signout-v3.spec.ts` | PASS - desktop global-scope test flaky (attempt 1 `toHaveURL(/login/)` saw `/dashboard`; passed retry)   |
| `e2e/corporate-tender.spec.ts`    | PASS - author/approve/refuse test flaky (attempt 1 `getByLabel("Tender title")` not ready; passed retry) |

### admin

**2 passed, 1 flaky, 0 failed (36.9s)**

| Spec                           | Result                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `e2e/admin-signout-v3.spec.ts` | PASS - desktop global-scope test flaky (attempt 1 `toHaveURL(/login/)` saw `/retailers`; passed retry #1) |

### Regression assessment

No stop-worthy regression. The only repeated flake is the **"desktop global-scope
sign-out"** test, present identically in all three apps: the first attempt after a
cold server boot times out (20s) waiting for page A to redirect after remote
session revocation, then passes deterministically on retry #1 every time. This is
a test-harness cold-start propagation-timing characteristic, not tied to either
merged candidate. **All specs ultimately GREEN.**

## 7. `pnpm --filter @paon/domain validate:completion` (expected RED)

Exit code **1**. Full output emitted before it aborts:

```
Invalid evidence 17.1.json:  - browserProofRun.gitSha: run gitSha b49bbb048eea750dac77af37ed1402d20a8a71a3 is not current for this checkout
Invalid evidence 17.14.json: - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.3.json:  - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.4.json:  - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.5.json:  - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.6.json:  - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.8.json:  - browserProofRun.status: verified status requires run status=passed (got failed)
                             - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 17.9.json:  - browserProofRun.status: verified status requires run status=passed (got failed)
                             - browserProofRun.gitSha: b49bbb0... is not current for this checkout
Invalid evidence 18.5.json:  - browserProofRun.gitSha: run gitSha 42e27d722497654593f2ec13ed09971f9aaec577 is not current for this checkout
Error: Completion evidence missing applicability/evidence/ui
    at parseCompletionEvidenceRecord (packages/domain/src/programme/completion-evidence.ts:420:11)
    at main (packages/domain/scripts/validate-completion-evidence.ts:87:20)
Exit status 1
```

**The script aborts with an uncaught throw at `docs/evidence/tranches/20.1.json`**
(next file in sort order after `18.5`). `20.1.json` carries an `evidence` block
but no `applicability` and no `evidence.ui`, which `parseCompletionEvidenceRecord`
rejects by throwing. Because the throw is uncaught, the run never reaches the
PHASE-item "missing evidence file" gate - so a full failing-item enumeration
**cannot be produced from the tool in its current state**. Everything it printed
before aborting is above.

**Per-file failures emitted before the abort:** `17.1`, `17.3`, `17.4`, `17.5`,
`17.6`, `17.8`, `17.9`, `17.14` (stale `browserProofRun` gitSha `b49bbb0`;
`17.8`/`17.9` also run status=failed) and `18.5` (stale `browserProofRun` gitSha
`42e27d7`).

### Baseline

The task-referenced `docs/evidence/reviews/platform-reconciliation-20260901/REPORT.md`
**does not exist on this branch**. Used `docs/GROUND_TRUTH.md` section 3 (co-named
in the task) as the known-failing baseline:

- **verified_local only (12):** 8.4, 9.1, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6,
  17.8, 17.9, 17.14, 18.5
- **stale evidence SHAs (4):** 4.9, 4.10, 8.4, 9.1
- **`[x]` with no evidence file (15):** 10.1, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2,
  12.4, 13.1, 13.2, 18.1, 18.2, 18.6, 18.8, 18.12

### Newly failing vs baseline: **NONE**

- Every item the tool emitted (17.1 / 17.3-17.6 / 17.8 / 17.9 / 17.14 / 18.5) is
  inside GROUND_TRUTH section 3's known-failing set.
- `git diff --stat ec84ac5..2cb28da` and `2cb28da..932a8ac` touch **no** file
  under `docs/evidence/tranches/**`, and **not**
  `packages/domain/scripts/validate-completion-evidence.ts` nor
  `packages/domain/src/programme/completion-evidence.ts`.
- Validator script last changed `eabc716`; parser last changed `f3c928b` - both
  ancestors of the pre-merge base `ec84ac5`.
- Crash-trigger `docs/evidence/tranches/20.1.json` last changed `2527fcc`,
  confirmed ancestor of `ec84ac5`.
- => the identical abort and the identical 9 per-file failures occur both before
  and after the RC integration.

### Tranche dispositions on rc HEAD `932a8ac`

| Item                                      | PHASE.md checkbox             | Validates now?    | Still needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R0.4**                                  | `[ ]` (line 1725) - not gated | No                | checkbox `[x]` **and** `docs/evidence/tranches/R0.4.json` (applicability + evidence + uiChecklist + browserProofSpec). Only a `docs/evidence/runs/R0.4-.../evidence.json` exists (SHA c74bea2).                                                                                                                                                                                                                                                                                                                                              |
| **20.6**                                  | `[ ]` (line 8122) - not gated | No                | checkbox `[x]` + `docs/evidence/tranches/20.6.json`. Run artifact `20.6-customer-appointments-audit/evidence.json` (SHA 8c8be81) exists.                                                                                                                                                                                                                                                                                                                                                                                                     |
| **20.7**                                  | `[ ]` (line 8142) - not gated | No                | checkbox `[x]` + `docs/evidence/tranches/20.7.json`. Run artifact `20.7-digital-fitting-room/` (SHA 78193960) exists.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **20.17**                                 | `[ ]` (line 8369) - not gated | No                | checkbox `[x]` + `docs/evidence/tranches/20.17.json`. Run artifact `20.17-customer-wardrobe-removal-v3/` (REPORT + 10 screenshots + evidence.json SHA 4daa18c) exists. The V3 removal flow itself is proven **GREEN** in section 6.                                                                                                                                                                                                                                                                                                          |
| **20.21**                                 | `[ ]` (line 8444) - not gated | No                | checkbox `[x]` + `docs/evidence/tranches/20.21.json`. Run artifact `20.21-storefront-dfr-handoff-v3/evidence.json` (SHA e1bad67) exists. The V3 handoff flow is proven **GREEN** in section 6.                                                                                                                                                                                                                                                                                                                                               |
| **4.6**                                   | `[x]` (line 2416) - gated     | **Indeterminate** | `docs/evidence/tranches/4.6.json` is present and structurally valid (per-file check passes). But `docs/evidence/runs/4.6.json` has gitSha `42e27d7` (status passed) which is **not current** for HEAD `932a8ac` - the gate that would flag this (same class as GROUND_TRUTH's 4.9/4.10/8.4/9.1) never runs because the script aborts at `20.1.json`. Needs: `runs/4.6.json` regenerated against a current SHA by re-running `apps/customer/e2e/virtual-studio.spec.ts`; and the `20.1.json` parser-abort fixed so the gate can evaluate 4.6. |
| _18.2 (also in `ec84ac5`, for reference)_ | `[ ]` (line 6846) - not gated | No                | checkbox `[x]` + `docs/evidence/tranches/18.2.json`. `docs/evidence/runs/18.2.json` gitSha = `932a8ac` (== HEAD), status passed, spec `corporate-tender.spec.ts` - proven **GREEN** in section 6, run artifact is current.                                                                                                                                                                                                                                                                                                                   |

## Real regression

**None.**

## Not completed

- A full `validate:completion` failing-item enumeration - blocked by the
  uncaught throw at the pre-existing malformed `docs/evidence/tranches/20.1.json`.
  This abort is present identically before the RC merges (`20.1.json`, the
  validator, and the parser are all unchanged in the RC range), so it is **not a
  regression introduced by this integration**. Everything emitted before the
  abort is captured above.
