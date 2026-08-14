# PAON Ground Truth — 2026-08-14

Measured reality for the `integration/ground-zero` branch. Every number here
came from a command that was actually run against this worktree on 2026-08-14.
Nothing in this file is inferred from a status claim in `PHASE.md`.

Baseline audited: `1f55894` (`integration/ground-zero` == `main`).

**Sections 1–7 are the ground-zero audit and describe `504c1b4`. They are kept
verbatim as the historical record and are not rewritten as `main` moves on.
Section 8 onward records what happened to `main` after ground zero was
promoted, one section per tranche; read the last of them before treating
section 1's gate table or section 4's branch table as current.**

## 1. Verified gate results

Run once, in order, on `/private/tmp/paon-integration`:

| Gate                                             | Result      |
| ------------------------------------------------ | ----------- |
| `pnpm lint`                                      | **PASS**    |
| `pnpm typecheck`                                 | **PASS**    |
| `pnpm build`                                     | **PASS**    |
| `pnpm format:check`                              | **PASS** \* |
| `pnpm --filter @paon/domain test`                | **PASS**    |
| `pnpm --filter @paon/domain validate:completion` | **FAIL**    |

\* `format:check` failed at `1f55894` on two files. Both are fixed in this
ground-zero pass: `packages/database/src/repositories/cited-recommendation-repository.ts`
by cherry-pick `f64ac28` (whitespace only), and this file by rewriting it.

`validate:completion` is the only gate that compares claims against proof, and
it is the only one still red. Section 2 is why. It is recorded as failing
rather than made green, because the only ways to turn it green today are to
re-run browser proofs in a live environment (out of scope for this audit) or to
weaken/re-date evidence (forbidden by ADR-068).

## 2. Completion truth: 31 claims unmarked

`validate:completion` rejects 31 items that `PHASE.md` marked `[x]`. All 31
were unmarked to `[ ]` in this pass. **No code was reverted.** Unmarking
records that a claim is unproven at this HEAD, not that the capability is
absent. Treat all 31 as `implemented_unverified`.

`PHASE.md` checkbox counts moved from 69 checked / 41 unchecked to **38 checked
/ 72 unchecked**.

### 2a. No evidence tranche exists at all (15)

`docs/evidence/tranches/<id>.json` is absent, so the ADR-068 gate has nothing
to evaluate:

`10.1, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.4, 13.1, 13.2, 18.1, 18.2, 18.6,
18.8, 18.12`

Eleven of these do have a run artifact under `docs/evidence/runs/`, so the
missing piece is the tranche record, not necessarily the proof run.

### 2b. Tranche exists but its browser-proof SHA is stale (16)

Each SHA below exists as a commit but is **not an ancestor of this branch**, so
the proof was run against history that is not in ground zero:

| Items                   | Stale browser-proof SHA |
| ----------------------- | ----------------------- |
| 4.6, 4.7/4.8, 4.9, 4.10 | `d5e66de`               |
| 8.4, 9.1                | `0a7ae8c`               |
| 17.1, 17.2              | `fc783be`               |
| 17.3                    | `71a90a1`               |
| 17.4, 17.5, 17.6        | `cc47e0d`               |
| 17.8                    | `99cb0ec`               |
| 17.9                    | `29b2177`               |
| 17.14                   | `964d9db`               |
| 18.5                    | `ef9f43c`               |

There are exactly **16 tranche files in the repository, and all 16 are in this
table** — no completion-evidence tranche currently passes the gate.

### 2c. Separately stale run artifact

`docs/evidence/runs/11.3.json` cites `6b74009`, which exists but is not an
ancestor of `main`.

**Interpretation unchanged from the previous audit:** the platform is broader
than it is proven. The risk for a paying retailer is not missing features, it
is features believed working that were never demonstrated end-to-end at a
commit that is actually shipped.

## 3. What was integrated into ground zero

One commit, cherry-picked with `-x`:

- `f64ac28` — `chore(format)` prettier line-wrap in
  `cited-recommendation-repository.ts`. Whitespace only, 2 lines, no behaviour
  change. Origin `587c12d` on `agent/claude-nguyen1`.

Nothing else was merged. See section 4 for why.

## 4. Branch truth

57 registered worktrees, 93 local branches, 150 refs including remotes.

**21 branches are fully patch-contained in `main`** (`git cherry` reports zero
unique patches). They are ahead only by merge topology and carry no unmerged
work: the `worker/ft13-*`, `worker/ft14-*`, `worker/mission-conversation-facts`,
`worker/house-memory-corrections`, `worker/11-1-payroll-manager-ui`,
`worker/ft09-attachment-quarantine`, `agent/lane-h-{payroll-backend,
phase-11-2-closeout, staff-evidence-profile, wfm103-assigned-missions}`, and
the `agent/lane-delegate-4-*` / `agent/lane-delegate-17-*` families. Safe to
prune; pruning was **not** performed in this pass.

**Seven large lane branches hold real unmerged feature work and every one
conflicts heavily against `main`.** Conflicted-file counts measured directly
with `git merge-tree --write-tree`:

| Branch                                    | Unique commits | Conflicted files |
| ----------------------------------------- | -------------- | ---------------- |
| `agent/lane-d-virtual-wardrobe-studio`    | 37             | 172              |
| `feature/voice-intelligence`              | 30             | 119              |
| `agent/lane-f-wardrobe-service-request`   | 34             | 111              |
| `agent/lane-e-core-roadmap`               | 32             | 108              |
| `agent/lane-h-customer-security-boundary` | 30             | 100              |
| `_integration-check`                      | 28             | 97               |
| `agent/lane-g-employee-portal-linking`    | 34             | (worktree dirty) |

All seven are **blocked-conflict** and were left untouched. `lane-h-customer-security-boundary`
additionally rewrites `clienteling_notes` RLS (introduces a `note_visibility`
tier and sensitive-access audit logging) — a security-critical change that must
not ride along in a ground-zero commit. `lane-g` also has 13 uncommitted files
in its live worktree. `feature/conversation-intelligence` shares
`_integration-check`'s head and adds no unique feature work.

**Migration prefix collision.** `20260806110000` is claimed by two different
migrations on different lanes:

- `20260806110000_add_style_portrait_consent.sql` (`lane-d`)
- `20260806110000_add_service_weekly_plans.sql` (`lane-e`, `lane-f`, `lane-g`)

Whichever lane merges second must be renamed forward per the migration
collision rule. Neither has been applied to ground zero.

**Small branches with unique work**, all left unmerged pending review:
`agent/claude-nguyen3` (7), `agent/codex-openrouter` (4),
`agent/lane-a-ft01-fitprofile` (4), `agent/claude-nguyen1` (3, minus the
cherry-picked format commit), `agent/lane-b-phase-12-3-booking-handoff` (3),
`agent/lane-c-18-9-contract-value` (3),
`agent/phase-19-1-fabric-pairing-module-key` (2), plus several single-commit
`worktree-agent-*` and `worker/*` branches.

**Two competing PHASE reconciliations already exist unmerged** —
`7935201 docs: unmark unproven phase completions` (on `codex-openrouter`,
`lane-b`, `phase-19-1`) and `ab56bfc docs(phase): reconcile PHASE.md status
against recorded evidence` (on `claude-nguyen1`). Neither was merged here.
Whoever integrates them must reconcile against section 2 by hand and must not
blanket-select `ours` or `theirs`.

## 5. Worktrees needing attention

- `/Users/nguyen/Projects/PAON` (the primary checkout) is on
  `agent/lane-h-customer-ai-conversation` with **3 unresolved merge
  conflicts**, 5 modified tracked files and 8 untracked files. Treated as
  read-only for this audit; nothing was reset, cleaned, aborted or switched.
- `/private/tmp/paon-claude-nguyen1` carried 5 uncommitted fleet-script changes
  predating this audit; committed unmodified as `8e2bcd9` on
  `agent/claude-nguyen1` to preserve them. Content overlaps the fleet safety
  fixes already on `main` and still needs reconciliation.
- `.claude/worktrees/agent-a5cd5e7ddd5a19fbe` holds 295 untracked files.

## 6. Fleet state

The shared queue in `$GIT_COMMON_DIR/paon-fleet/queue.json` is **frozen** and
was left frozen:

> Founder control-plane freeze: no product feature work until the founder
> resumes.

41 tasks: **19 open, 16 blocked, 6 done, 0 actively claimed.** The 13 tasks
carrying a `claimed_by` value are all in `done` or `blocked` state — residual
attribution, not live leases. No agent was started, nudged, messaged or
assigned during this audit.

## 7. What ground zero does not claim

- It does not claim `validate:completion` passes. It does not.
- It does not claim the 31 unmarked items are unimplemented — only unproven.
- It does not claim the seven large lanes are safe to merge. They are not, yet.
- It does not claim anything about live Supabase or Vercel state. No live or
  deploy action was taken.

## 8. Post-ground-zero tranche 1 — 2026-08-14

### 8a. Promotion

`main` was fast-forwarded to `integration/ground-zero`. Ancestry was strictly
linear and verified before the move: `origin/main` `5b77fd0` → local `main`
`1f55894` → `integration/ground-zero` `504c1b4`, with `origin/main` zero commits
ahead. `git merge --ff-only` in a fresh `main` worktree at
`/private/tmp/paon-main-tranche`, then a non-force push. `origin/main` is now
`504c1b4` and beyond. The primary checkout `/Users/nguyen/Projects/PAON` was
treated as read-only throughout and is untouched: still on
`agent/lane-h-customer-ai-conversation` at `a665a26` with its unfinished merge
(3 conflicted files) and 13 dirty/untracked entries.

### 8b. Integrated — four source commits, five commits on `main`

All cherry-picked with `-x`, one at a time, each reviewed and acceptance-run
before the next was started.

| On `main` | Origin    | From                     | What                                                           |
| --------- | --------- | ------------------------ | -------------------------------------------------------------- |
| `ab80d14` | `7ee275f` | `agent/claude-nguyen1`   | QR wardrobe card scoped to its owning retailer (17.13)         |
| `f86ef1b` | `29ab0e6` | `agent/codex-openrouter` | fabric-pairing gated on `garment_service_operations` (19.1)    |
| `6872ff8` | —         | this tranche             | prettier line-wrap required by `f86ef1b`                       |
| `6e50bfd` | `90622c7` | `agent/codex-openrouter` | withdraw stale cited recommendations on fact correction (14.2) |
| `caeef05` | `5a261dc` | `agent/codex-openrouter` | link partner engagements to bookings (12.3)                    |

Nine files changed in total, +85/−12. No migration was added: every column the
integrated code touches (`booking_id`, `withdrawn_at`, `withdrawn_reason`,
`wardrobe_items.public_token`) already existed on `main`. No RLS, auth, payment,
stock or money path was altered. Two of the five are tenant-scoping
corrections — `ab80d14` closes a cross-retailer render/link hole on an anonymous
public route, `f86ef1b` closes a module-entitlement bypass on two directly
invokable Server Actions that the layout guard never covered.

### 8c. Reviewed and deliberately not merged

| Commit                                     | Branch             | Disposition                                                                                                                                                     |
| ------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ab56bfc`                                  | `claude-nguyen1`   | superseded — competing PHASE/GROUND_TRUTH reconciliation off the same parent `504c1b4` reconciled                                                               |
| `587c12d`                                  | `claude-nguyen1`   | duplicate — identical patch-id to `f64ac28`, already on `main`                                                                                                  |
| `8e2bcd9`                                  | `claude-nguyen1`   | superseded — 4 of its 5 fleet files are byte-identical to `main`; `launch-fleet.sh` on `main` is strictly ahead. Picking it would revert `1f55894`              |
| `6092ba0`                                  | `claude-nguyen2`   | superseded — reformats the pre-reconciliation `GROUND_TRUTH.md`; `main`'s copy already passes prettier                                                          |
| `0c6b658`, `a6bd2ce`                       | `claude-nguyen2`   | merge-only, no unique patch                                                                                                                                     |
| `14b0273`                                  | `claude-nguyen3`   | superseded — every behaviour is in `main`; picking it would restore the broad `["packages/**","apps/**"]` path fallback that `main` replaced with `needs_scope` |
| `d4c62e2`, `20808e7`, `8748178`, `0624bfe` | `claude-nguyen3`   | parked — evidence-only SHA refreshes. Merging them would move proof SHAs without re-running proofs                                                              |
| `e2ec91a`                                  | `claude-nguyen3`   | duplicate — a cherry-pick of `90622c7`; `90622c7` taken as canonical                                                                                            |
| `9e1bb60`                                  | `claude-nguyen3`   | parked — empty commit, handoff diagnostics in the message only. See 8e                                                                                          |
| `7935201`                                  | `codex-openrouter` | superseded — the second competing PHASE reconciliation                                                                                                          |

### 8d. Gate results at the end of this tranche

Run once each with `TURBO_FORCE=1` (the turbo cache is shared across worktrees,
so an unforced run replays logs from other checkouts):

| Gate                                             | Result                           |
| ------------------------------------------------ | -------------------------------- |
| `pnpm lint`                                      | **PASS**                         |
| `pnpm typecheck`                                 | **PASS**                         |
| `pnpm build`                                     | **PASS**                         |
| `pnpm format:check`                              | **PASS**                         |
| `pnpm --filter @paon/domain test`                | **PASS** (111 files, 1192 tests) |
| `pnpm --filter @paon/domain validate:completion` | **FAIL**                         |

`validate:completion` fails on exactly the 16 tranches of section 2b and on
nothing else — every message is `run gitSha … is not current for this
checkout`. No new failure class appeared. `format:check` is now green including
`docs/`, closing the section 1 asterisk.

### 8e. Carried forward, unfixed

- **18.9 corporate-renewal regression.** `agent/claude-nguyen3`'s `9e1bb60` is
  an empty commit whose message records a reproduced, deterministic failure in
  `apps/retailer/e2e/corporate-renewal-analytics.spec.ts:114` — contract value
  submits, the URL advances, the field reloads empty. Its author ruled out
  schema, generated types, and application-code drift, and its leading
  unconfirmed hypothesis is that `setContractValue`'s UPDATE matches zero rows
  because the session's `current_retailer_id()` does not match the programme's
  `retailer_id`, with the Server Action returning successfully anyway. Not
  merged (nothing to merge) and not investigated here. 18.9 is founder-parked;
  whoever unparks it should start from that commit message.
- **The seven blocked-conflict lanes of section 4** were confirmed unchanged at
  their audited heads and were not inspected further.
- **The 16 stale browser-proof SHAs** still require a live-environment re-run,
  not an edit.

## 9. Post-ground-zero tranche 2 — 2026-08-14

Baseline `95c8505`. Scope: the four remaining small branches section 4 listed as
"unmerged pending review". **Nothing was integrated.** All four carry zero
behaviour that `main` lacks, and each was refused for reasons that are now
recorded so no later tranche re-derives them.

### 9a. Classification

| Branch                                       | Unique vs `main` | Classification                         |
| -------------------------------------------- | ---------------- | -------------------------------------- |
| `agent/lane-a-ft01-fitprofile`               | 4 commits        | parked + superseded + conflict-blocked |
| `agent/lane-b-phase-12-3-booking-handoff`    | 3 commits        | duplicate                              |
| `agent/lane-c-18-9-contract-value`           | 3 commits        | parked + superseded + conflict-blocked |
| `agent/phase-19-1-fabric-pairing-module-key` | 2 commits        | duplicate                              |

### 9b. `lane-b` and `phase-19-1` — duplicate

`git cherry` marks their substantive commits `-`, and blob comparison confirms
it. `522024d` has the same patch-id as `5a261dc`, already on `main` as
`caeef05`; `5745aef` has the same patch-id as `29ab0e6`, already on `main` as
`f86ef1b`. Every path either branch touches is byte-identical to `main` except
`fabric-pairing/page.tsx`, where the only difference is the prettier line-wrap
`main` added in `6872ff8` — `main` is strictly ahead.

Both branches also carry `7935201 docs: unmark unproven phase completions`. It
unchecks 15 items (10.1, 11.1–11.4, 12.1, 12.2, 12.4, 13.1, 13.2, 18.1, 18.2,
18.6, 18.8, 18.12); all 15 are **already** unchecked on `main`, because
`504c1b4` unmarked 31. `main` is strictly more conservative, so the commit is
superseded, not merely redundant.

### 9c. `lane-a` — FT-01 is parked, and `main` already carries a corrected version

FT-01's disposition is unambiguous: `docs/PHASE.md:70` `- **Park:** FT-01, …`,
the PARKED row at `:250`, the parked list at `:389`, and
`docs/FOUNDER_TOOL_BLUEPRINTS.md:188` "**Park.** Do not extend as a standalone
tool."

Separately, the work already landed on `main` as `d0b8ea1`, with the migration
renamed forward from the branch's `20260806000000` (a prefix `main` had already
given to `_add_consultation_origin_to_appointments.sql`) to
`20260810120000_add_fit_profile_candidates.sql`. `main`'s version is not a
copy — it is a **correction**, and cherry-picking the branch would undo three
real fixes:

1. The branch's `approve_fit_profile_candidate` inserts into
   `customer_fit_profile_entries`. Migration `20260719000101` renamed that table
   to `legacy_customer_fit_profile_entries` and revoked all access, on the
   founder clarification (superseding ADR-015) that PAON "does not own generic
   customer measurements". `main`'s version deliberately writes no
   customer-level measurement row and says so in a comment.
2. The branch derives the candidate's `customer_id` from
   `v_first_observation.physical_garment_id::uuid` — a garment id used as a
   customer id. `main` derives it from the observation's own `fitting_sessions`
   row.
3. The branch's guard reads `perform public.fitting_observations`, which is not
   a valid statement; `main` reads `perform 1 from public.fitting_observations`.

`git merge-tree --write-tree main 5571335` reports **7 conflicted files** (two
add/add). The branch also commits `apps/retailer/e2e/fit-tools.spec.ts.bak`, a
stray backup (`.bak` is not gitignored on `main`), and writes
`docs/evidence/runs/FT-01.json` citing `9945837`, which is not an ancestor of
`main`.

### 9d. `lane-c` — 18.9 is founder-parked, and `main` already carries a corrected version

`docs/PHASE.md:7518` heads the item `- [ ] **18.9 Parked — vague corporate
analytics and renewal engine**`, with a **Founder scope override (2026-08-12)**
making it "non-selectable as a generic analytics/renewal build lane" and a
status of `parked_pending_concrete_manager_job` that says to "**Retain the
existing cited metrics/history, but do not extend a generic analytics or
renewal product.**"

The work also already landed on `main` as `5a0c968`. The branch's
`20260805240000_add_contract_value_and_repair_kind.sql` is **byte-identical SQL**
to `main`'s `20260810110000_add_contract_value_and_repair_kind.sql`; the branch
prefix was renamed forward because its hour field is `24`, which is not a valid
hour and violates the `YYYYMMDDHHMMSS` convention. `main`'s application code is
the corrected one: a typed `CorporateRepository.setContractValue` and
`findProgrammeById` where the branch uses a raw client with
`as any` / `Record<string, unknown>` casts.
`packages/domain/src/corporate/renewal-analytics.ts` and its test are already
byte-identical between branch and `main`.

`git merge-tree --write-tree main e7f8b3c` reports **5 conflicted files**. The
branch's `docs/evidence/runs/18.9.json` cites `b17873e`, not an ancestor of
`main`; `main`'s cites `5a0c968`. Under rule 6 the branch would in any case have
gone to separate frontier/security review rather than a cherry-pick: it carries
a migration, a constraint change, and a money field.

### 9e. Gate results at the end of this tranche

`main` is unchanged in code from `95c8505`; the gates were still re-run once
each with `TURBO_FORCE=1`.

| Gate                              | Result                           |
| --------------------------------- | -------------------------------- |
| `pnpm lint`                       | **PASS** (12/12, 0 cached)       |
| `pnpm typecheck`                  | **PASS** (12/12, 0 cached)       |
| `pnpm build`                      | **PASS** (3/3, 0 cached)         |
| `pnpm format:check`               | **PASS**                         |
| `pnpm --filter @paon/domain test` | **PASS** (111 files, 1192 tests) |
| `pnpm validate:completion`        | **FAIL**                         |

`validate:completion` fails on exactly the same 16 evidence files as section 8d
(4.6, 4.7, 4.9, 4.10, 8.4, 9.1, 17.1–17.6, 17.8, 17.9, 17.14, 18.5) and every
message is `run gitSha … is not current for this checkout`. No additional
failure class appeared.

### 9f. What this leaves

Section 4's "small branches with unique work" list is now fully reviewed: the
four branches named here plus `claude-nguyen1`/`2`/`3` and `codex-openrouter`
from section 8. None of them has unmerged material work left. What remains
unmerged is the seven blocked-conflict lanes of section 4, still untouched, plus
the `20260806110000` migration prefix collision recorded there.

`agent/lane-a-ft01-fitprofile` and `agent/lane-c-18-9-contract-value` are safe
to delete once the founder confirms; both are superseded by corrected
implementations already on `main`. Deletion was **not** performed. No branch,
worktree or evidence file was modified by this tranche.
