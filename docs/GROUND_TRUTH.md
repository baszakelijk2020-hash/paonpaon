# PAON Ground Truth — 2026-08-14

Measured reality for the `integration/ground-zero` branch. Every number here
came from a command that was actually run against this worktree on 2026-08-14.
Nothing in this file is inferred from a status claim in `PHASE.md`.

Baseline audited: `1f55894` (`integration/ground-zero` == `main`).

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
