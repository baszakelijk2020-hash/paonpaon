# PAON Ground Truth — 2026-08-14

Where the build actually stands, measured on the consolidated
`integration/ground-zero` branch. Every number here came from a command that
was actually run, not from a status claim in `PHASE.md`.

## 1. Consolidation: complete

All five live agent lanes are fully contained in `integration/ground-zero`.
Verified with `git rev-list --count integration/ground-zero..<branch>`:

| Lane                                    | Head      | Commits not in ground-zero |
| --------------------------------------- | --------- | -------------------------- |
| `agent/claude-nguyen1`                  | `c1480f6` | **0**                      |
| `agent/claude-nguyen2`                  | `3c1f7f5` | **0**                      |
| `agent/claude-nguyen3`                  | `c598825` | **0**                      |
| `agent/codex-openrouter`                | `7a60398` | **0**                      |
| `agent/openrouter-codex`                | `bb115ce` | **0**                      |
| `agent/lane-h-customer-ai-conversation` | —         | **0**                      |

Uncommitted source across all five worktrees: **none** (only untracked
scratch: `TASK_VERIFICATION.txt`, `.codex-*` runner state).

**Nothing from the overnight run was lost.** Consolidation had been stalled
by a single unresolved merge (`agent/claude-nguyen2` → ground-zero) with four
conflicts, now resolved by unioning both lanes' work — two agents had
independently built _different_ PHASE 10.4 packages (`annual_event` and
`valentine_reservation_rescue`); both are kept.

## 2. Build health on the consolidated branch

| Gate             | Result                                                        |
| ---------------- | ------------------------------------------------------------- |
| `pnpm lint`      | **PASS** — 12/12 packages                                     |
| `pnpm typecheck` | **PASS** — 12/12 packages                                     |
| `pnpm test`      | **FAIL** — evidence validator (below); 1192 domain tests pass |
| `pnpm build`     | see run log                                                   |

## 3. The real finding: completion is over-claimed

`pnpm --filter @paon/domain validate:completion` is the only gate that
compares claims against proof, and it fails. This is the honest answer to
"where am I standing".

> **Corrected 2026-08-14 by the `phase-md-reconciliation` pass.** The first
> version of this section listed three problems. There are two. It claimed the
> validator "does not accept `verified_local`" — it does:
> `VERIFIED_STATUSES` in `packages/domain/src/programme/completion-evidence.ts`
> contains both `verified_local` and `verified_live`. Every
> "status verified_local is not a verified completion claim" line is
> `mayMarkPhaseItemComplete` reporting a downstream failure, and in all 12
> cases that failure is the stale run SHA below. The stale-SHA count was also
> understated: 4 was the subset the gate reports, but the file-level validator
> rejects **all 16** tranche records.

**Cause 1 — 15 items marked `[x]` have no evidence tranche file at all:**
`10.1, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.4, 13.1, 13.2, 18.1, 18.2,
18.6, 18.8, 18.12`

**Cause 2 — all 16 tranche records carry a stale run `gitSha`,** i.e. the
proof was run against a commit whose code has since changed:
`4.6, 4.7, 4.9, 4.10, 8.4, 9.1, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.8,
17.9, 17.14, 18.5`. Twelve of these are also reported by the checkbox gate;
`4.6`–`4.10` are Stage-4 items that `requiresCompletionEvidence`
grandfathers out of the gate, so they fail file-level validation only.

### What that actually means per item

13 of the 15 in Cause 1 are **implementation-complete with a `passed` run
artifact already on disk** — the tranche record was simply never written.
That is record-keeping, not build work. Two are genuine over-claims and their
checkboxes have been unmarked in `PHASE.md`:

| Item   | Was   | Now   | Why                                                                                                                      |
| ------ | ----- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| `11.1` | `[x]` | `[ ]` | Prose claims "E2E browser-proven (2026-08-11)". No run artifact, no tranche record. The only one of the 15 with neither. |
| `18.6` | `[x]` | `[ ]` | `docs/evidence/runs/18.6.json` records `"status": "failed"`. It was checked against a recorded failing proof.            |

`18.6` is the sharpest finding in this audit: every other gate failure is a
missing or aged record, this one is a **recorded failure that was marked
complete anyway**.

Running the numbers the other way: there are 61 run artifacts but only 16
tranche records. Proof is being _generated_ far more often than it is being
_recorded_. That ratio, not the feature backlog, is what makes the tree
unsellable on paper.

Interpretation: the platform is **broader than it is proven**. For a paid
pilot the risk is not missing features, it is features believed working that
were never demonstrated end-to-end. Closing this gap outranks new capability.

Rule when closing these: if a capability is not actually proven, **unmark the
checkbox** — do not fabricate or re-date evidence (ADR-068). Specifically, do
not edit `runs/18.6.json` from `failed` to `passed`; re-run the spec.

### Known defect in the gate itself

`EVIDENCE_ONLY_PATH_RE` in
`packages/domain/scripts/validate-completion-evidence.ts` names the doc paths
that may change without ageing out a proof SHA. It covers `docs/PHASE.md` and
`docs/evidence/` but **not `docs/GROUND_TRUTH.md`** — so every edit to this
very file invalidates every evidence SHA behind it. Add
`docs/GROUND_TRUTH\.md$` to that pattern before the evidence lanes run, or
they will chase a moving target.

## 4. Repository hygiene

- 56 worktrees, 146 branches.
- **7 stale lane branches hold real unmerged feature work** (5–8 days old,
  30–54 conflicts each): `lane-d-virtual-wardrobe-studio` (VWS 4.9/4.10),
  `lane-g-employee-portal-linking`, `lane-f-wardrobe-service-request`,
  `lane-e-core-roadmap`, `lane-h-customer-security-boundary`,
  `feature/voice-intelligence`, `feature/conversation-intelligence`.
  Deliberately **not** merged in this pass — ~250 conflicts at once would
  jeopardise the now-clean tree. Queued as `consolidate-stale-lanes`, to be
  merged one lane at a time, each verified green before the next.

## 5. Why the fleet kept idling (root cause, now fixed)

| #   | Root cause                                                                                                                      | Fix                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Agents launched with **no prompt, not in tmux**; every watchdog scans `tmux list-panes`, so 4 of 5 were unreachable             | `scripts/fleet/launch-fleet.sh` starts all 5 in named tmux sessions with an opening task |
| 2   | `scripts/claude-stop-check.sh` was a quality gate that `exit 0`'d — **idling was by design**                                    | `scripts/fleet/stop-continue.sh` emits `{"decision":"block"}` with the next queued task  |
| 3   | The only never-stop runner (`paon-run.sh`) was **not running and single-writer**                                                | Replaced by a multi-agent atomic queue                                                   |
| 4   | `AGENTS.md:316` mandated `.agent/claims.yaml`; **it was never created**, so 5 agents picked work by parsing a 500 KB `PHASE.md` | `scripts/fleet/paon-fleet` — atomic claims with leases                                   |

Also dead and now superseded: `paon-agent-watchdog.sh` / `codex-watchdog.sh`
targeted tmux sessions `paon-claude` / `paon-codex` that never existed;
`agent-autocontinue` log was 0 bytes since Aug 12; the launchd supervisor was
`.disabled`.

## 6. The orchestrator

State lives in `$GIT_COMMON_DIR/paon-fleet/` — shared by every worktree,
never committed, so it cannot produce a merge conflict.

```
scripts/fleet/paon-fleet        atomic claim/lease CLI (plain bash+jq:
                                works for Claude, Codex AND DeepSeek)
scripts/fleet/seed-queue.sh     PHASE.md -> machine-readable queue
scripts/fleet/stop-continue.sh  Stop hook: gate, then hand over next task
scripts/fleet/session-start.sh  SessionStart hook: never wake up idle
scripts/fleet/launch-fleet.sh   start/stop/status/nudge all 5 in tmux
```

Proven behaviour:

- **5 agents racing simultaneously → 5 distinct tasks, zero collisions.**
- **Lease expiry → orphaned task auto-recovered by another agent** (kill an
  agent mid-task and the work is picked up with no human involvement).
- Red tree ⇒ the Stop hook refuses to hand out new work until the agent
  fixes its own lint/typecheck and commits.
- At ≤5% remaining usage the agent commits, releases its lease and stops
  cleanly, so the next agent inherits a coherent repo.

Model routing is enforced by which tiers an agent may claim:
`claude-nguyen1/2` = frontier+implementation, `claude-nguyen3` =
implementation+light, `codex` = implementation+light, `deepseek` = light.

## 7. Next

Queue is seeded with **41 tasks**, ordered for sellability rather than PHASE
number. Top of queue:

1. `consolidate-stale-lanes` — the 7 unmerged lanes
2. `prune-dead-worktrees`
3. `phase-md-reconciliation`
4. `evidence-missing-15`
5. `evidence-verified-local-12`
6. `evidence-stale-sha`
