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

## 10. Post-ground-zero tranche 3 — legacy-branch classification, 2026-08-15

Baseline `698f3e207377824b23cde49350b52c6c68740374`, local `main` equal to
`origin/main`, worktree clean, Fleet frozen with zero active claims. Scope: the
seven blocked-conflict lanes of section 4, the migration collision it records,
and the primary checkout. **Nothing was integrated. No code, migration, test,
branch or worktree was modified.** Execution planning lives in
`ORCHESTRATION_2.md`.

### 10a. Verification posture

Classification was fanned out to eight bounded read-only subagents, then every
load-bearing conclusion was re-verified directly. That mattered: **three
subagent claims were wrong on first report** and survived only until
re-checked. They are named in 10c, 10h and 10j rather than quietly dropped, so
no later tranche re-derives them. Treat subagent output in this repository as a
lead, never as a finding.

### 10b. The seven branches are five segments over one shared base

The central structural fact, and the reason section 4's table overstates the
problem:

```
main (698f3e2) ── merge-base 6ca3611
                      │
                      └── 28 commits ── _integration-check (934b540)
                                        ≡ feature/conversation-intelligence
                                             ├── +10 → lane-d-virtual-wardrobe-studio
                                             ├── +2  → feature/voice-intelligence
                                             ├── +2  → lane-h-customer-security-boundary
                                             └── +4  → lane-e-core-roadmap
                                                        └── +2 → lane-f ≡ lane-g
```

Verified by `git merge-base --is-ancestor` for every pair. Two identities are
exact, not approximate:

- `_integration-check` and `feature/conversation-intelligence` are the **same
  commit** `934b540`.
- `agent/lane-f-wardrobe-service-request` and
  `agent/lane-g-employee-portal-linking` are the **same commit** `1b6381d`.

All seven share merge-base `6ca3611`. There are **48 distinct commits**, not
the 225 that section 4's per-branch counts imply, and the conflict counts in
that table are dominated by the shared 28-commit base rather than by each
lane's own work. Section 4's unique-commit numbers are individually correct and
were reproduced exactly; the table simply invites the wrong conclusion, because
it presents one shared problem as seven.

### 10c. Correction to section 2b — the evidence SHAs are not stale by ancestry

Section 2b states that each of the 16 evidence files cites a SHA that is "not
an ancestor of this branch". **That is incorrect, and was incorrect when
written.** All nine distinct SHAs are ancestors of `main` _and_ were already
ancestors of ground zero `504c1b4` itself:

| SHA                                                   | ancestor of `main` | ancestor of `504c1b4` |
| ----------------------------------------------------- | ------------------ | --------------------- |
| `d5e66de`, `0a7ae8c`, `fc783be`, `71a90a1`, `cc47e0d` | yes                | yes                   |
| `99cb0ec`, `29b2177`, `964d9db`, `ef9f43c`            | yes                | yes                   |

The real mechanism is different and matters more. `validate:completion` does
not test ancestry at all. It calls `isCurrentGitSha`
(`packages/domain/src/programme/completion-evidence.ts:309-315`) and requires
the run's `gitSha` to equal the **current** checkout SHA, emitting
`run gitSha … is not current for this checkout`.

Consequence: **every commit to `main` invalidates all 16 evidence files
again.** This is structural, not a property of these particular proofs. It
independently confirms the standing instruction to regenerate browser proof
only after integration stabilizes — doing it earlier is wasted by
construction. Sections 1–7 are kept verbatim per this file's own convention;
this subsection is the correction of record.

### 10d. Shared base `_integration-check` / `feature/conversation-intelligence`

28 commits, 98 files, +11486/−299. It is **not** merely combined topology: it
carries unique capability that `main` lacks.

**Already integrated** — `20260805240000` contract-value and `20260806000000`
fit-profile-candidates landed on `main` renamed forward as `20260810110000`
and `20260810120000` (section 9c/9d). The two follow-up fixes
`20260806000002` (derive `customer_id` from the real parent, not
`physical_garment_id`) and `20260806000003` (stop writing to the table
`20260719000101` renamed away) are both already folded into `main`'s
`20260810120000`.

**Active unique salvage candidates — three cross-tenant integrity fixes that
`main` does not have.** Each migration documents a _reproduced_ hole, not a
theoretical one:

| Migration        | Hole                                                                                                                                                                                 | State on `main`                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `20260806000004` | Staff of any retailer could attach a row — including a monetary `wedding_guest_vouchers` row — to another retailer's wedding party, and that retailer's organizer could then read it | **absent**; `wedding_parties_id_retailer_id_key` not present    |
| `20260806000005` | Same class across the whole corporate/BD chain: tender approvals, entitlement issues, advisor-capture insights attachable to another retailer's parent                               | **absent**; `corporate_accounts_id_retailer_id_key` not present |
| `20260806000006` | A crafted POST to `createClientelingNote` could attach a note to another retailer's real customer                                                                                    | **partial, in the misleading direction**                        |

The `20260806000006` case needs care. `main` _does_ have
`customers_id_retailer_id_key` — but it arrives at
`20260814000000_add_store_feedback_signals.sql:6`, added incidentally for an
unrelated feature. The composite foreign key on `clienteling_notes` is
**absent**: `20260720000003_create_clienteling_notes.sql:4` still declares the
plain `customer_id uuid not null references public.customers(id)`. `main` has
the harmless half of the fix and not the half that closes the hole. A grep for
the constraint name alone would wrongly report this as fixed.

Each fix is small, self-contained, and re-creatable as a forward patch with a
new prefix; each ships with pgTAP coverage that `main` also lacks.

**Active unique salvage candidates — founder authority absent from `main`:**
`docs/RELATIONSHIP_INTELLIGENCE_BLUEPRINT.md` (907 lines, Rank 2 authority) and
`docs/documentation-audit/FOUNDER_ANSWERS.md`, which records two explicit
founder rulings (Q4: repository authority exists exactly once, tool docs must
delegate; Q5: correct the out-of-repo `paon.html` citation). Both files are
verified absent from `main`.

**Parked** — the 17-file `docs/documentation-audit/` bundle, the
`docs/archive/` snapshots, and the evidence-run SHA rewrites (governance and
reversibility artifacts; the SHA rewrites must not be merged, per 10c).

`feature/conversation-intelligence` is the same commit and adds nothing:
**duplicate**.

### 10e. `agent/lane-d-virtual-wardrobe-studio` (+10)

**Already integrated.** All seven VWS migrations are **byte-identical** to
`main` at identical filenames and timestamps — verified by object-hash
comparison, not by name:

`20260806100000` foundation, `20260806110000` style-portrait consent,
`20260806120000` output storage, `20260806130000` visual presets,
`20260806140000` outfit-slot insert policy, `20260807100000` feedback signal,
`20260807110000` generation style evidence.

Style Portrait consent is therefore already on `main` in full: explicit,
revocable, `granted`/`denied`/`withdrawn`, gated on
`disclosures_acknowledged`. Renders are private — bucket `wardrobe-studio`,
`public = false`, tenant-scoped path structure and RLS. Tenancy is enforced in
depth by RLS plus triggers.

The application code is **superseded**: `main` is strictly ahead, having added
six further VWS migrations (`20260809130000`–`20260809180000`) that gate
enqueue on module state _and_ explicitly re-check consent, plus
`assertRetailerModuleActive` guards in the Server Actions. Merging the branch
would remove those guards. FT-09 and suit-jacket research show no unique
residue here.

### 10f. `feature/voice-intelligence` (+2)

Genuinely **active voice/clienteling behaviour**, not generic AI expansion: the
system prompt reads an advisor note "typed or spoken, then transcribed", and
the branch carries an `unresolved` bundle kind whose purpose is to surface
ambiguous speech for a human instead of guessing.

**Superseded.** `main` took a different and broader design at
`20260812000020`/`20260812000021`: bundle kinds `appointment` and
`care_booking` rather than the branch's `appointment_proposal` and
`unresolved`, and `main` deliberately removed the `appointmentContext` the
branch adds. This is a product-direction difference, not a missing fix.

AI-governance posture, both sides: grounding is **strong** — a bundle is
refused unless its `sourceExcerpt` is a literal substring of the source text.
Human review is **strong** — every bundle requires explicit advisor
confirmation. Tenant isolation is **strong** — all policies scope on
`current_retailer_id()`. Consent is _staff-initiated_, with no customer
consent record on either side. **Retention has no expiry policy on either
side** — captured conversation content persists indefinitely. That gap is
`main`'s too, and is the one item here worth carrying forward.

### 10g. `agent/lane-h-customer-security-boundary` (+2) — security-critical

**Needs security review.** The boundary does not exist on `main` under any
name: `note_visibility`, `record_customer_access_event`,
`canStaffAccessCustomerRelationshipData` and `findByRetailerForStaffView` all
return zero hits across `packages/`, `apps/` and `supabase/`.

What it does: replaces the blanket retailer-wide SELECT on `clienteling_notes`
with a four-tier `note_visibility` model (`author_only`, `assigned_advisor`,
`management`, `retailer_shared`) keyed on authorship, management override and
`customers.assigned_staff_id`; and adds a metadata-only sensitive-access RPC
writing to `audit_log_entries`.

Things it gets right, verified directly: the backfill direction is **safe** —
the column defaults new rows to the narrow `assigned_advisor`, while existing
rows are explicitly backfilled to `retailer_shared`, preserving prior exposure
rather than widening it. The `SECURITY DEFINER` function pins `search_path`,
derives tenant identity from the session, and is granted only to
`authenticated`. The pgTAP suite contains **real adversarial negative cases**,
including a genuine cross-tenant attempt asserting zero rows.

Two findings must close before this can merge, both verified:

1. **Incomplete authorization wiring.** `customers/[id]/page.tsx` computes
   `canViewRelationshipIntelligence` but uses it 4 times against 11 uses of
   the weaker role-only `canManage`. Loyalty account, interest projection,
   customer facts and AI history remain visible to an unassigned associate,
   and `customer_facts` RLS is retailer-wide with no assignment check. Only
   `AdvisorBriefRepository` is disclosed as deferred; these are not.
2. **Audit immutability unproven at the grant layer.** `audit_log_entries` is
   **not** in the table list of
   `20260801000016_enforce_append_only_grants.sql` (0 matches), so
   `service_role` — which bypasses RLS entirely — may retain
   `UPDATE`/`DELETE`/`TRUNCATE` on the ledger this feature depends on. No
   exploiting call site exists in current code; the guarantee is simply
   unestablished and needs a live-grant check.

A third, non-security regression: `appointments/[id]/page.tsx` and its print
route call `notes.find(n => n.pinned)` and are untouched by the branch, so a
pinned note would silently vanish for non-assigned staff with no indication.

### 10h. `agent/lane-e-core-roadmap` (+4)

Real code, not documentation churn — roughly 86% working code and tests.

**FT-14 weekly plan — blocked by founder decision.** `service_weekly_plans`
appears nowhere in `main`'s code. But `main` already carries a _different_
FT-14: `agent/preferred-tailoring-monthly-grid` (`5cefa49`) is **fully
integrated**, with zero unique commits versus `main`. A subagent reported this
branch as simultaneously an ancestor of `main` and "not yet integrated"; the
first is true and the second is false. So this is not an integration question
but a product question: **weekly proposed plan versus monthly grid** — the
founder must choose before either is extended.

**18.7 corporate auto-advance — superseded.** `main` has `b41e00c`, with
`advanceStageForAccount` and `advanceToFittingIfDue` both present. The
branch's `20d1615` is a parallel implementation of the same feature, three
days older.

The hooks commit `5e02b3b` touches `.claude/settings.json` and is **out of
scope by standing instruction** — recorded, not acted on.

### 10i. `agent/lane-f` ≡ `agent/lane-g` (+2) and lane-g's dirty worktree

**Committed state: duplicate.** The two branch names are one commit. Against
`main`, `packages/domain/src/wardrobe/wardrobe.ts`,
`apps/customer/app/(dashboard)/wardrobe/actions.ts` and
`apps/customer/e2e/wardrobe.spec.ts` are **byte-identical**; `main` landed the
same capability independently as `170aed8`. Only `wardrobe-panel.tsx` differs,
and there the branch is a **regression** — it deletes
`completeTheLookSuggestions` code that `main` keeps.

The Employee Portal blueprint (`1b6381d`) is **superseded**: `main` already
implemented what it plans (`ef9f43c`, plus migrations `20260809200000`,
`20260809210000`, `20260809220000`, `20260810100000`).

**Dirty worktree, 13 entries, classified read-only and left untouched** (7
modified, 6 untracked). Ten are duplicates of work `main` already has. Four
are not on `main`:

| Entry                                                                        | Disposition                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/domain/src/corporate/wearer-customer-link.ts`                      | active unique salvage candidate                                     |
| `packages/domain/src/corporate/wearer-customer-link.test.ts`                 | active unique salvage candidate                                     |
| `supabase/tests/wearer_customer_link_test.sql`                               | active unique salvage candidate — asserts the email-only-match trap |
| `supabase/migrations/20260807110000_add_wearer_customer_account_linking.sql` | split — see below                                                   |

The migration defines two RPCs and they classify differently — it must not be
salvaged or discarded as a unit:

- `link_my_wearer_account()` — **superseded**. `main` has its own version at
  `20260809200000_add_employee_portal_customer_data_access.sql:217`, same
  signature, `security definer`, `search_path` pinned, granted only to
  `authenticated`.
- `create_and_link_wearer_customer_account()` — **active unique salvage
  candidate**. Absent from `main` entirely (zero matches across `supabase/`,
  `packages/` and `apps/`). This is the explicit opt-in linking path, as
  distinct from `main`'s silent-match path, and it pairs with the
  `wearer_customer_link_test.sql` pgTAP case above.

No secret, credential or `.env` file is present among them. Nothing was staged,
committed, stashed or cleaned.

### 10j. Primary checkout `/Users/nguyen/Projects/PAON` — read-only

Confirmed exactly as briefed and **entirely unmodified**. Branch
`agent/lane-h-customer-ai-conversation`, HEAD `a665a26`, unfinished merge with
`.git/MERGE_HEAD` = `87c1fa0` ("feat(morning-routine): wire real cart/order
creation for Buy action", 2026-08-13), which is an ancestor of neither `main`
nor `a665a26`.

Conflict stages: `actions.ts` and `routine-panel.tsx` are `UU` with stages
1/2/3; `morning-routine.spec.ts` is `AA` with stages 2/3 only.

**The merge's headline capability is already on `main`.** A subagent reported
that `main` "treats buy as a navigation-only stub" and that the merge source
was therefore uniquely valuable. That is wrong.
`main:apps/customer/app/(dashboard)/morning-routine/actions.ts` implements the
full buy path — the `productVariantId` guard, the saved-address precondition
with the same "Turn on 1-Tap Checkout first" message, `orderRepo.addToCart`
(line 199) and `orderRepo.checkoutCart` (line 204). The capability is
**already integrated**. What `main` appears to lack is the _e2e assertion_ for
it; that, not the feature, is the only salvage candidate here.

Modified tracked: `.claude/settings.json` and `AGENTS.md`, both **off-limits**
and both _older_ than `main` (`AGENTS.md` is 800 lines against `main`'s 2030 —
a regression, not new work). Untracked: two founder documents absent from
`main` — `docs/PAON_VISUAL_WARDROBE_PRECISION_AUTHORITY.md` and
`docs/fuckingchanges.md` — plus local agent tooling (`.agents/`, `.vscode/`,
three watchdog scripts) and `image.png`. `.env.local` exists but is matched by
`.gitignore:77`, is untracked and never appears in `git status`: no exposure
risk.

A recovery procedure exists in `ORCHESTRATION_2.md` terms — capture stages via
`git show :2:<path>` / `:3:<path>` to a location outside the repository,
copy the two founder documents out, then decide. **It was not executed, and
must not be until the founder rules.**

### 10k. Migration collisions

**The recorded collision is already resolved in `main`'s favour.** Section 4
frames `20260806110000` as two unmerged lanes racing. It is not:
`main` **already holds** `20260806110000_add_style_portrait_consent.sql`, and
it is applied — `style_portrait_consents` is present in
`packages/database/src/generated/database.types.ts`. `lane-e`'s
`20260806110000_add_service_weekly_plans.sql` never reached `main` and is
absent from the generated types. It is the file that must be renamed forward;
it can never reclaim that prefix.

**A second, live collision exists on `main` and is more urgent.** Four
migrations share the prefix `20260814000000`:

```
20260814000000_add_ft04_alteration_grid_snapshots.sql
20260814000000_add_gift_invitation_expiry_revoke_refund.sql
20260814000000_add_retailer_branch_location_details.sql
20260814000000_add_store_feedback_signals.sql
```

`supabase db reset --local` fails on duplicate version. **No local database can
be built on `main` today**, so no pgTAP, no browser proof and no evidence
regeneration is possible. This is the root cause behind the blocked
`evidence-stale-sha` task and the three unregenerable tranches 17.2, 17.9 and
17.14. It is `ORCHESTRATION_2.md` tranche 3, the first execution tranche.

Security review requirement: the three salvaged FK migrations of 10d each add
a unique constraint plus a composite foreign key. They must land with negative
pgTAP proof, and `20260814000000_add_store_feedback_signals.sql` must keep a
prefix earlier than them, since it is what creates
`customers_id_retailer_id_key`.

### 10l. Disposition summary

| Branch                                    | Head      | Unique           | Disposition                                                                                                          |
| ----------------------------------------- | --------- | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `_integration-check`                      | `934b540` | 28 (shared base) | **active unique salvage candidate** — 3 tenant FK fixes + 2 founder documents; remainder already integrated / parked |
| `feature/conversation-intelligence`       | `934b540` | 0                | **duplicate** — same commit as `_integration-check`                                                                  |
| `agent/lane-d-virtual-wardrobe-studio`    | `ec6b540` | +10              | **already integrated** (all 7 migrations byte-identical) / **superseded** (app code; `main` strictly ahead)          |
| `feature/voice-intelligence`              | `a02dd10` | +2               | **superseded** — `main` chose a different design                                                                     |
| `agent/lane-h-customer-security-boundary` | `9da15ef` | +2               | **needs security review** — absent from `main`; 2 findings must close                                                |
| `agent/lane-e-core-roadmap`               | `d3af01d` | +4               | FT-14 **blocked by founder decision**; 18.7 **superseded**                                                           |
| `agent/lane-f-wardrobe-service-request`   | `1b6381d` | +2               | **duplicate** (code byte-identical to `main`) / blueprint **superseded**                                             |
| `agent/lane-g-employee-portal-linking`    | `1b6381d` | 0                | **duplicate** — same commit as `lane-f`                                                                              |
| lane-g dirty worktree                     | —         | 13 entries       | 10 **duplicate**, 3 **salvage candidates**; its migration splits — one RPC **superseded**, one **salvage candidate** |
| primary checkout                          | `a665a26` | unfinished merge | buy path **already integrated**; 2 founder docs **salvage**, config **off-limits**                                   |

### 10m. Genuine remaining blockers

1. **`20260814000000` four-way prefix collision on `main`** — blocks every
   local database, hence every proof. First execution tranche.
2. **Three unmerged cross-tenant integrity fixes** for reproduced holes, one
   of them touching monetary vouchers.
3. **ADR-074 boundary** — two open findings plus an unverified grant-layer
   guarantee on `audit_log_entries`.
4. **FT-14 founder decision** — weekly plan versus the already-integrated
   monthly grid.
5. **16 evidence files** — invalidated by every commit (10c); regenerate once,
   last.
6. **`docs/evidence/runs/18.5.json` has no producer** — every 18.5 spec
   declares a suffixed `PHASE_ITEM_ID`, so the bare id can never regenerate.
7. **Queue seeder auto-queues founder-parked scope** — Stage 13, Stage 15,
   16.2, 16.3, 16.5, 18.9, 18.10.
8. **No retention/expiry policy** on captured conversation content on `main`.

### 10n. What this tranche did not do

No merge, cherry-pick, rebase or conflict resolution. No branch or worktree
deleted. No migration run. No application, package, migration, test or
configuration file modified. `docs/PHASE.md` untouched. `AGENTS.md`, Claude
settings and hooks untouched. `/Users/nguyen/Projects/PAON` untouched. No
Fleet task seeded, claimed or unfrozen — Fleet remains **frozen**. No live
Supabase or Vercel action. Only `docs/GROUND_TRUTH.md` and
`docs/ORCHESTRATION_2.md` were written.

## 11. Orchestration 2.0 tranches 3 and 4 — 2026-08-15

### 11a. Tranche 3 — migration-prefix collision repair (`db88e3d`)

Four migrations shared the prefix `20260814000000`, so `supabase db reset`
failed on duplicate version and **no local database could be built at all**.
That single fact was upstream of most of the repository's blocked work: no
pgTAP, no browser proof, no evidence regeneration.

Three were renamed forward, contents untouched (all `R100` pure renames, 0
insertions, 0 deletions):

| From             | To               | Migration                                  |
| ---------------- | ---------------- | ------------------------------------------ |
| `20260814000000` | `20260814000001` | `add_ft04_alteration_grid_snapshots`       |
| `20260814000000` | `20260814000002` | `add_gift_invitation_expiry_revoke_refund` |
| `20260814000000` | `20260814000003` | `add_retailer_branch_location_details`     |

`add_store_feedback_signals` kept `20260814000000` because it creates
`customers_id_retailer_id_key`, which tranche 4 depends on.

This **inverts authorship order** — `store_feedback_signals` was authored
last (04:28) yet holds the earliest prefix. That is safe here, and the
reason is recorded so nobody re-derives it: the four migrations touch
disjoint tables with no cross-references, so no relative ordering among
them can break DDL. Had they been interdependent, the rename plan would
have been wrong.

Result: `supabase db reset --local` succeeds, 248 migrations applied, 0
un-applied, no duplicate prefix anywhere in the tree.

### 11b. Tranche 4 — cross-tenant composite-FK integrity (`512969d`)

The three reproduced holes of section 10d, re-created as forward patches
rather than merged from the legacy branches:

| Migration        | Closes                                                               |
| ---------------- | -------------------------------------------------------------------- |
| `20260815000000` | 5 wedding-party child tables, incl. `wedding_guest_vouchers` (money) |
| `20260815000010` | 14 edges of the corporate/BD chain                                   |
| `20260815000020` | `clienteling_notes -> customers`                                     |

Two decisions the 2026-08-06 originals did not face:

1. `20260815000020` must **not** re-add `customers_id_retailer_id_key`.
   `main` already acquired it incidentally from
   `20260814000000_add_store_feedback_signals`, which needed it for its own
   key. `main` had the harmless half of the fix and not the half that closes
   the hole. A test asserts exactly one such constraint exists.
2. Every composite key states an `ON DELETE` action mirroring the existing
   single-column key (17 `CASCADE`, 1 `RESTRICT`), so deletion behaviour is
   unchanged and does not depend on two keys with different actions
   resolving in a particular order. The exception is
   `corporate_opportunities.linked_account_id`: a composite `SET NULL` is
   impossible because it would also null the `NOT NULL` `retailer_id`, so it
   stays `NO ACTION`. That interaction is proved behaviourally, not argued.

**Proof.** 21 pgTAP assertions across three files. Every negative case runs
as a real authenticated tenant principal — a House B staff member with live
JWT claims, writing a row RLS fully permits — and expects `23503`. A `42501`
would mean RLS stopped the write first and the key went untested; one draft
failed exactly that way (hit a `23514` check constraint) and was corrected
rather than accepted. Positive controls prove no over-blocking, and the
`UPDATE` re-parenting path is covered, not only `INSERT`.

Full pgTAP: **407/409**. The two failures pre-exist on clean `main` and were
baselined by removing the six new files, resetting and reproducing both
identically — `stock_tenant_boundaries` #11 and
`wedding_guest_voucher_redemption` #3. The first is itself a security
finding on `main` (two `SECURITY DEFINER` functions executable by `PUBLIC`)
and belongs to no tranche yet.

### 11c. The class is not closed — measured residue

Tranche 4 closed the three **documented** holes. It did not close the
structural class, and this is now the largest known integrity gap in the
schema. Measured against the live local database with tranche 4 applied,
counting every single-column foreign key where the child and the parent
both carry `retailer_id`:

| Metric                                                                                 | Count   |
| -------------------------------------------------------------------------------------- | ------- |
| Tenant-scoped parent/child pairs                                                       | **479** |
| Protected by a composite `(fk_col, retailer_id)` key                                   | **54**  |
| **Unprotected**                                                                        | **425** |
| Distinct unprotected child tables                                                      | **203** |
| Of those, child tables whose staff `INSERT` policy checks only `current_retailer_id()` | **121** |

The 121 figure is the one that matters: those carry the same exploitable
shape as the three holes just fixed. Two independent audits — the frontier's
and a non-authoring reviewer's — produced the 425 figure separately and
agreed.

Named residue inside the very module tranche 4 touched, all currently
exploitable by the same method:

`corporate_projects.account_id`, `corporate_project_events.project_id`,
`corporate_announcements.programme_id`,
`corporate_office_visit_requests.programme_id`,
`corporate_renewal_tasks.programme_id`,
`corporate_rollout_slots.rollout_day_id`,
`corporate_rollout_slots.wearer_id`,
`corporate_exception_events.exception_id`,
`corporate_concept_assets.tender_version_id`,
`corporate_issue_records.order_id`.

Beyond it, `orders` and `retailer_staff_members` are widely-referenced
tenant-scoped parents with no composite protection anywhere — the latter via
`*_staff_id` in roughly eighty tables, meaning a row in one house can
attribute an action to another house's staff member.

**Do not cite tranche 4 as evidence that the schema is tenant-safe.** Both
migration headers say so themselves.

### 11c-bis. Tranche 4b — the class is now closed

Section 11c recorded 425 unprotected pairs, of which 238 were genuinely
exploitable (child `INSERT` policy checking only `current_retailer_id()`).
Tranche 4b closed all of them in three slices:

| Slice | Commit    | Scope                                | Edges |
| ----- | --------- | ------------------------------------ | ----- |
| 4b.1  | `4277616` | `customers` children                 | 26    |
| 4b.2  | `f2f0c48` | all remaining tenant-owned parents   | 133   |
| 4b.3  | `e20ae67` | `retailer_staff_members` attribution | 66    |

**Measured result: remaining exploitable cross-tenant edges = 0.**

**The correction that shaped this work.** A first cut of slice 2 bound every
parent that merely had a `retailer_id` column. It broke four test suites, and
the reason matters more than the fix: **"both tables have `retailer_id`,
therefore they must match" is false.** `metadata_concepts` and
`knowledge_objects` are platform-global vocabulary with a **nullable**
`retailer_id` where NULL means platform-owned, and their own RLS policies
special-case `retailer_id IS NULL`. A retailer's `entity_metadata_assignment`
pointing at a global concept, or a `retailer_knowledge_override` overriding a
global object, is correct behaviour — and a composite key can never match a
NULL parent `retailer_id`, so binding those parents destroys the feature
instead of securing it.

The discriminator now in force, and asserted by test so it cannot be lost: a
parent is eligible for tenant binding only if its `retailer_id` is **NOT
NULL**. Nullable means shared, and shared is excluded.

All DDL was generated from the live catalogue rather than transcribed, so
several hundred statements could not drift from the real schema, and every
composite key mirrors the `ON DELETE` action of the single-column key it
parallels — `SET NULL` necessarily becoming `NO ACTION`, since a composite
`SET NULL` would null the `NOT NULL` `retailer_id`.

Full pgTAP after 4b: **426/428**, the two failures being the ones that
pre-exist on `main` (`stock_tenant_boundaries` #11, which is itself an open
security finding, and `wedding_guest_voucher_redemption` #3).

### 11d. Adjacent, deliberately not widened into tranche 4

- `createClientelingNote`
  (`apps/retailer/app/(dashboard)/customers/[id]/actions.ts`) still performs
  no same-tenant check on the client-supplied `customerId`, unlike its
  siblings in the same file. The database now blocks the write, but it
  surfaces as a raw `23503` out of a Server Action rather than a domain
  error.
- `wedding_date_candidates` has no client `INSERT` policy; writes appear to
  go through a `SECURITY DEFINER` path that bypasses RLS by design and needs
  its own review before a foreign key is bolted on.
- Every evidence file was invalidated again by these two commits moving
  `HEAD`, exactly as 10c predicts. Regenerate once, last.
