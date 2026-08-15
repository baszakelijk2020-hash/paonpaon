# PAON Orchestration — the running system

**This file is the handoff contract.** Any model, window or session takes over
the frontier role by reading this plus `ORCHESTRATION_2.md` and
`GROUND_TRUTH.md`, with no access to any prior conversation. Rewritten each
cycle. Trust it over recollection; verify anything load-bearing against Git and
the live database before acting.

Last rewritten: 2026-08-15.

## 1. Take over in four commands

```bash
cd /private/tmp/paon-main-tranche
git fetch origin main && git status --short --branch   # must be clean, == origin
scripts/fleet/paon-fleet status
tmux list-sessions | grep paon-w-
```

## 2. What the system actually is

Four moving parts. Nothing here is aspirational — every piece is running.

```
  docs/PHASE.md ──seed-queue.sh──▶ queue.json ──paon-fleet take──▶ agent
        (roadmap)                  (62 tasks,      (atomic claim,      │
                                    leased)         one per agent)     │
                                        ▲                              │
                                        │                              ▼
                                   paon-fleet done ◀────── work, acceptance, commit
                                        │
   stop-continue.sh (Claude Stop hook) ─┘   fleet-crons (30s: watchdog + reap)
   "you would go idle → here is your next task"   keeps non-Claude lanes alive
```

**1. The queue is the roadmap, not a wishlist.** `seed-queue.sh` parses
`docs/PHASE.md`, skips every item under a `### Stage N (parked|deleted)`
heading, and writes one machine-readable task per open item. Nobody picks work
by reading PHASE.md themselves — that was slow, non-deterministic and collided.

**2. `paon-fleet` hands work out atomically.** `take` claims the top eligible
task under a lease, filtered by the agent's `PAON_AGENT_TIERS`. One lease per
agent, enforced. `done` / `block` / `release` are the only exits. `heartbeat`
extends a lease on long work; `reap` frees expired ones.

**3. `stop-continue.sh` is why agents do not idle.** It is a Claude Code Stop
hook. Exit 0 means "stopping is fine"; returning
`{"decision":"block","reason":…}` feeds that reason back to the model as its
next instruction. So when an agent would stop, the hook instead: gates on
lint/typecheck, refuses to hand out new work on a dirty tree, then calls `take`
and blocks with the claimed task as the reason. The agent continues into real,
non-colliding work with no human in the loop.

**4. `/tmp/paon-fleet-crons.sh` keeps the non-Claude lane alive.** Every 30s it
inspects the DeepSeek pane locally (never calling a model to decide), injects a
queue-pull only when Codex shows its built-in idle suggestion, and runs
`paon-fleet reap` so a dead lane cannot park a task behind an expired lease.

## 3. Why an agent can still appear idle

Worth stating plainly, because it looks like a fault and mostly is not.

- **A Claude session is turn-based.** It exists only while a turn runs. There is
  no background thread between turns. `stop-continue` is what restarts it.
- **The hook only fires on a stop**, and allows it in exactly three cases:
  `NO_ELIGIBLE_WORK`, an empty queue, or `take` erroring. The first is common
  in the seconds after a `reap` reconciles the queue — a real observed window.
- **Long explanatory replies are idle time.** Every sentence written to the
  operator instead of to a tool is a turn not spent working.

## 4. Lanes

| Lane                    | Model                             | Tiers                 | State                                        |
| ----------------------- | --------------------------------- | --------------------- | -------------------------------------------- |
| frontier (this session) | Opus                              | all                   | sole integrator to `main`                    |
| `paon-w-queue-ds`       | `deepseek/deepseek-v4-flash-0731` | light, implementation | queue-fed, watchdog-kept                     |
| `paon-claude-nguyen1`   | —                                 | —                     | **founder's own side project. NEVER touch.** |

Claude worker lanes are retired by founder instruction. Do not spawn more.

**Relaunch the DeepSeek lane** (both env vars mandatory — without
`OPENROUTER_API_KEY`, Codex silently falls back to the paid ChatGPT account;
confirm the pane reads `deepseek/deepseek-v4-flash-0731` before trusting it):

```bash
tmux new-session -d -s paon-w-queue-ds -c /private/tmp/paon-queue-ds \
  "CODEX_HOME=$HOME/.config/paon-agent-launcher/codex-openrouter \
   OPENROUTER_API_KEY=<key> PAON_NON_CLAUDE_AGENT=1 \
   CLAUDE_PROJECT_DIR=/private/tmp/paon-queue-ds \
   PAON_AGENT_ID=openrouter-deepseek PAON_AGENT_TIERS=light,implementation \
   codex --dangerously-bypass-approvals-and-sandbox"
(nohup /tmp/paon-fleet-crons.sh > /dev/null 2>&1 &)
```

## 5. Hard-won operational facts

Each cost a real diagnosis. Do not rediscover them.

- **Fleet identity is the worktree basename** (`PAON_AGENT_ID` overrides).
  Running `heartbeat` from the integration worktree is rejected — fleet
  commands must run from the agent's own worktree.
- **A prompt sent to a TUI needs a second, separate Enter.** A Claude session
  cannot relocate its own root, and a `cd` prompt will not move a Codex
  session — relaunch in the right worktree instead.
- **`pnpm start` hardcodes its port** and ignores `PORT`. The cross-app proof
  needs customer on 3002 and retailer on 3011; use `npx next start -p N`.
- **Browser proofs need `PAON_E2E_MOCK_AI=1`** plus a localhost Supabase URL,
  or grounded-draft assertions hit live OpenAI.
- **`TURBO_FORCE=1`** — the turbo cache is shared across worktrees, so an
  unforced run replays another checkout's logs.
- **Evidence commits must be evidence-only.** `isCurrentGitSha` accepts an
  ancestor SHA when every path changed since is evidence-only
  (`EVIDENCE_ONLY_PATH_RE`). Land code first, run every proof, then commit
  artifacts alone — mixing them invalidates the proofs in the same commit.
- **Specs sharing the fixture customer are order-dependent.** `visual-roadmap`
  and `4.10` pass alone and fail after another spec ran. Use `--workers=1`.

## 6. Defects this system found by running on itself

- **`take` handed out unlimited leases** (`3b7f2c4`). One agent held two tasks
  at once. Every lane would have hoarded work the moment quota returned.
- **`seed-queue.sh` truncated wrapped headings** (`48add00`). Tasks were served
  with titles cut mid-sentence — and the title is the agent's statement of work.
- **Module-level proof flags across parallel workers** (`2cee8f0`, and 17.9).
  Specs passed while their artifacts recorded `failed`, because each worker has
  its own module instance. 18.6 and 18.7 were recorded as failing for reasons
  that had nothing to do with the product.
- **The watchdog never fired once** — it matched the `›` prompt char with `.`,
  but `›` is three UTF-8 bytes.

## 7. Hard invariants

- Never write to `/Users/nguyen/Projects/PAON`, and never touch
  `paon-claude-nguyen1`.
- Never modify `AGENTS.md` or `.claude/**`.
- Never merge, rebase or cherry-pick a legacy branch — salvage is re-authored
  as a forward patch against current `main`.
- Never weaken a boundary to make a test pass. Two tests were corrected
  _upward_ this session because the stronger behaviour was the correct one.
- A parent is eligible for composite tenant binding only if its `retailer_id`
  is **NOT NULL**. Nullable means platform-shared vocabulary; binding those
  breaks the feature. Learned by breaking four suites.
- A worker's "done" claim is not evidence. Read the whole diff, confirm it
  stayed inside `owned_paths`, and re-run its acceptance yourself.

## 8. Open decisions only the founder can make

- **FT-14**: `main` ships the monthly grid (`5cefa49`); `lane-e` holds a
  competing weekly-plan implementation. Product choice.
- **Tranche 10**: branch and worktree retirement.
