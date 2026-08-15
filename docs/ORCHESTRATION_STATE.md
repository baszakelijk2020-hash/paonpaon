# PAON Orchestration — live state

**This file is the handoff contract.** Any model, window or session can take
over the frontier role by reading this file plus `ORCHESTRATION_2.md` and
`GROUND_TRUTH.md`, with no access to the previous session's conversation.
It is rewritten every orchestration cycle. Trust it over any recollection;
verify anything load-bearing against Git and the live database before acting.

Last updated: 2026-08-15, cycle 3.

## 1. Take over in four commands

```bash
cd /private/tmp/paon-main-tranche
git fetch origin main && git status --short --branch   # must be clean, == origin
git log --oneline -8
tmux list-sessions | grep paon-w-                      # live workers
```

Proceed only if the worktree is clean and local `main` equals `origin/main`.
If they differ, stop and reconcile before anything else.

## 2. Current position

| Fact                 | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `main`               | `64c4308` (verify — this file lags by design)              |
| Integration worktree | `/private/tmp/paon-main-tranche`, branch `main`            |
| Fleet                | **FROZEN**, 0 claimed. Do not unfreeze.                    |
| pgTAP                | 444/444 PASS as of `69fb055`                               |
| Primary checkout     | `/Users/nguyen/Projects/PAON` — **READ-ONLY, never touch** |

## 3. Roadmap position

Source of truth for what comes next: the tranche table in
`ORCHESTRATION_2.md` §2, then open non-parked items in `PHASE.md`. Never
invent work; never select founder-parked scope.

| Tranche                     | State                                                  |
| --------------------------- | ------------------------------------------------------ |
| 3 prefix collision          | done `db88e3d`                                         |
| 4 cross-tenant FK           | done `512969d`                                         |
| 4b residual tenant-FK class | done — `4277616`, `f2f0c48`, `e20ae67`; 0 edges remain |
| 5 founder-authority docs    | done — `13f1373`, `10961db`, `40add23`                 |
| 6 ADR-074 boundary          | done `69fb055` + app guard `64c4308`                   |
| 7 FT-14 weekly vs monthly   | **BLOCKED: founder decision**                          |
| 8 lane-g salvage            | done `7662383`                                         |
| 9 browser-proof refresh     | **NEXT** — producer map in flight (t9a)                |
| 10 branch retirement        | **BLOCKED: founder decision**                          |

Off-roadmap work also completed: `c53b157` (last red pgTAP test),
`14d704b` and `17a9a1d` (two `SECURITY DEFINER`/grant fixes), `4fc309e`
(18.5 evidence producer).

## 4. Workers in flight

Workers commit to their own branch in their own worktree. They never touch
`main`. The frontier is the only integrator.

| Session      | Worktree                  | Branch                                | Task                                           |
| ------------ | ------------------------- | ------------------------------------- | ---------------------------------------------- |
| `paon-w-t9a` | `/private/tmp/paon-w-t9a` | `worker/t9a-evidence-spec-inventory`  | tranche 9 producer map                         |
| `paon-w-t6b` | `/private/tmp/paon-w-t6b` | `worker/t6b-clienteling-tenant-guard` | **superseded** — done by frontier as `64c4308` |

Each worktree holds a `WORKER_BRIEF.md` stating that worker's exact contract.
Read it before judging their output.

**Relaunch a dead Claude worker:**

```bash
tmux new-session -d -s <sess> -c <worktree> \
  "PAON_AGENT_ID='<id>' PAON_REPO_ROOT='/Users/nguyen/Projects/PAON' claude --permission-mode bypassPermissions"
```

**Relaunch the DeepSeek worker** (must carry both env vars, or Codex silently
falls back to the paid ChatGPT account — verify the pane reads
`deepseek/deepseek-v4-flash-0731` before trusting any output):

```bash
tmux new-session -d -s <sess> -c <worktree> \
  "CODEX_HOME=$HOME/.config/paon-agent-launcher/codex-openrouter \
   OPENROUTER_API_KEY=<from keychain or founder> PAON_NON_CLAUDE_AGENT=1 \
   codex --dangerously-bypass-approvals-and-sandbox"
```

A prompt sent to a TUI needs a second, separate Enter to submit; a Claude
session cannot relocate its own root, and a `cd` prompt will not move a Codex
session — relaunch in the right worktree instead.

## 5. The cycle

1. Poll worker branches for new commits.
2. For each commit: read the **whole** diff, confirm it stayed inside
   `owned_paths`, and **re-run its acceptance yourself**. A worker's "done"
   claim is not evidence — one has already reported done with a failing
   format gate.
3. Cherry-pick accepted work onto `main`, run gates, push.
4. Immediately re-dispatch that worker its next roadmap tranche: new
   worktree, new branch, new `WORKER_BRIEF.md`.
5. While workers run, advance frontier-only work and push each provable slice.
6. Rewrite this file. Never idle.

## 6. Gates — nothing merges without these

```bash
git diff --check
pnpm format:check
TURBO_FORCE=1 pnpm typecheck
supabase db reset --local --yes
supabase test db                      # must be all-green
```

`TURBO_FORCE=1` matters: the turbo cache is shared across worktrees and an
unforced run replays another checkout's logs.

## 7. Hard invariants

- Never unfreeze Fleet. `unfreeze` is global and would expose 19 open tasks
  including founder-parked scope the seeder queued in error.
- Never write to `/Users/nguyen/Projects/PAON`.
- Never modify `AGENTS.md`, `.claude/**`, or `docs/PHASE.md` outside tranche 9.
- Never merge, rebase or cherry-pick a legacy branch. Salvage is re-authored
  as a forward patch against current `main`.
- Never weaken a boundary to make a test pass. Two tests here were corrected
  _upward_ precisely because the stronger behaviour was the correct one.
- A parent is eligible for composite tenant binding only if its `retailer_id`
  is **NOT NULL**. Nullable means platform-shared vocabulary; binding those
  breaks the feature. This rule was learned by breaking four suites.

## 7b. Capacity constraints (checked 2026-08-15 09:10)

- **Claude workers are limit-blocked.** The `paon-w-t6b` pane reports
  "You've hit your session limit · resets 12:10pm (Asia/Saigon)". Prompts land
  but get no response. Do not keep re-sending; either wait for the reset or
  take the task as frontier, which is what happened to t6b.
- **DeepSeek/OpenRouter is available** and is the working lane meanwhile.
  Always confirm the pane reads `deepseek/deepseek-v4-flash-0731` — an absent
  `OPENROUTER_API_KEY` makes Codex silently fall back to the paid ChatGPT
  account, which is itself out of quota.
- If the frontier session hits its own limit, a successor takes over from this
  file alone. That is the entire reason it exists.

## 8. Open decisions only the founder can make

- **FT-14**: `main` already ships the monthly grid (`5cefa49`, integrated);
  `lane-e` holds a competing weekly-plan implementation. Product choice.
- **Tranche 10**: branch and worktree retirement.
- Batch these. Do not stall other work waiting on them.
