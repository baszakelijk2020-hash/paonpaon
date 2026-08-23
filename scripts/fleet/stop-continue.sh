#!/usr/bin/env bash
# stop-continue.sh — Claude Code Stop hook that ACTUALLY continues the fleet.
#
# THE BUG THIS REPLACES
#   scripts/claude-stop-check.sh ran lint+typecheck then `exit 0`. Exit 0 on a
#   Stop hook means "yes, stopping is fine" — so every agent went idle after
#   every task, by design. Crons then tried to poke idle tmux panes, but 4 of
#   the 5 agents were launched in VS Code terminals and were invisible to them.
#
# WHAT THIS DOES INSTEAD
#   1. Quality gate first: if lint/typecheck fail, block and send the agent
#      back to fix its own mess (never hand out new work on a red tree).
#   2. Usage wind-down: at/below the configured remaining-budget threshold,
#      tell the agent to commit, release its lease and stop cleanly, so the
#      next agent inherits a coherent repo instead of a half-edit.
#   3. Otherwise: pull the next task from the shared atomic queue and block
#      with it as the reason — Claude Code feeds `reason` back to the model,
#      so the agent immediately starts real, non-colliding work.
#
# CONTRACT: exit 0 = allow stop. JSON {"decision":"block","reason":...} = keep
# going with that instruction.
set -uo pipefail

# Claude-only. Codex/OpenRouter lanes were inheriting this hook and failing
# with exit 127 / invalid stop-hook JSON on every turn. Exit silently there.
[ -n "${PAON_NON_CLAUDE_AGENT:-}" ] && exit 0

# Loop-prevention: Claude Code sets stop_hook_active=true on the hook-input
# JSON when this same Stop hook already blocked once this turn and is now
# firing again after the model's forced continuation. Without this check
# every block was immediately re-triggered by the model's own next turn,
# producing an unbreakable loop with no way for a human to end the session.
# Read stdin once (Claude Code's contract for Stop hooks) and bail out clean
# on the repeat firing; a normal first-time stop has no stdin input at all,
# so a missing/unparseable payload must NOT be treated as "already active".
hook_input="$(cat 2>/dev/null || true)"
if [ -n "$hook_input" ] && printf '%s' "$hook_input" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$REPO_ROOT" || exit 0
FLEET="$REPO_ROOT/scripts/fleet/paon-fleet"
AGENT_ID="${PAON_AGENT_ID:-$(basename "$REPO_ROOT")}"

emit_block() { # $1 = reason text
  jq -nc --arg r "$1" '{decision:"block", reason:$r}'
  exit 0
}

# --- 1. never hand out new work on a red tree --------------------------------
if ! lint_out="$(pnpm lint 2>&1)"; then
  emit_block "STOP BLOCKED — lint is failing on your own working tree. Fix it before taking any new task. Do not start new work. Failing output (tail):
$(printf '%s' "$lint_out" | tail -30)"
fi
if ! tc_out="$(pnpm typecheck 2>&1)"; then
  emit_block "STOP BLOCKED — typecheck is failing on your own working tree. Fix it before taking any new task. Do not start new work. Failing output (tail):
$(printf '%s' "$tc_out" | tail -30)"
fi

# --- 2. uncommitted work must be committed before moving on -------------------
dirty="$(git status --porcelain | grep -v '^?? scratchpad/' | grep -v 'claude-stop-check' | head -20)"
if [ -n "$dirty" ]; then
  emit_block "DO NOT STOP. You have uncommitted work. Commit it now with a conventional message (prefix 'WIP:' if unfinished) — never leave the tree dirty for the next agent — and then IMMEDIATELY continue: re-run your acceptance, or ask the queue for your next task with 'scripts/fleet/paon-fleet take'. Committing is not a stopping point.

This gate previously ended with 'then stop', which is an explicit instruction
to go idle, and it fires BEFORE the task hand-over below. Because every browser
proof rewrites docs/evidence/runs/*.json, the tree is dirty most of the time —
so that wording made 'commit and stop' the normal outcome instead of 'commit
and keep working'. Uncommitted:
$dirty"
fi

# --- 3. usage-aware wind-down -------------------------------------------------
# PAON_USAGE_REMAINING_PCT is exported by the usage watcher. Below the
# threshold we deliberately stop taking new work.
threshold="${PAON_WINDDOWN_PCT:-5}"
remaining="${PAON_USAGE_REMAINING_PCT:-100}"
if [ "${remaining%%.*}" -le "$threshold" ] 2>/dev/null; then
  claimed="$("$FLEET" status 2>/dev/null | grep "\[$AGENT_ID\]" | head -1 || true)"
  if [ -n "$claimed" ]; then
    id="$(printf '%s' "$claimed" | awk '{print $2}')"
    "$FLEET" release "$id" "usage wind-down at ${remaining}% remaining" >/dev/null 2>&1 || true
  fi
  exit 0   # allow stop — budget nearly exhausted, repo left coherent
fi

# --- 4. hand over the next task ----------------------------------------------
[ -x "$FLEET" ] || exit 0
task="$("$FLEET" take 2>/dev/null)" || exit 0

# NO_ELIGIBLE_WORK means "nothing this agent may safely CLAIM" — which is not
# the same as "nothing to do", and this branch used to exit 0 and let the agent
# go idle. That was the single largest source of observed idleness: the queue
# routinely has no claimable task for a given agent (every open task's paths
# collide with a live lease, or they are all the wrong tier) while there is
# real standing work available to anyone.
#
# So instead of stopping, hand over STANDING DUTIES — bounded, always-safe,
# never-colliding verification work that needs no lease.
#
# Throttled deliberately. Standing duties are idempotent, so an agent with a
# genuinely quiet queue would otherwise re-run them forever and burn quota for
# nothing. After STANDING_MAX consecutive hand-overs with no new claimable
# task appearing, the agent is allowed to stop — a real stop condition, not a
# disguised idle. The counter resets the moment a real task is claimed.
STANDING_STATE="${TMPDIR:-/tmp}/paon-standing-duty.$(basename "$REPO_ROOT")"
STANDING_MAX=3

case "$task" in
  ""|NO_ELIGIBLE_WORK|QUEUE_EMPTY)
    n=$(( $(cat "$STANDING_STATE" 2>/dev/null || echo 0) + 1 ))
    printf '%s' "$n" > "$STANDING_STATE"
    if [ "$n" -gt "$STANDING_MAX" ]; then
      rm -f "$STANDING_STATE"
      exit 0   # genuine stop: queue quiet and standing duties already swept
    fi
    emit_block "DO NOT STOP. The queue has no task you may claim right now
(every open task collides with a live lease or is the wrong tier), but that is
not the same as nothing to do. Standing duties, pass $n of $STANDING_MAX —
none of these need a lease and none can collide with another agent:

1. PROOF FRESHNESS. For each docs/evidence/runs/*.json, compare its gitSha to
   HEAD. Re-run any spec whose proof is stale or whose status is not 'passed',
   then commit the regenerated artifacts in an EVIDENCE-ONLY commit.
2. UNINTEGRATED WORK. For each worker branch, check whether it holds commits
   whose content is not on main. Verify, then integrate anything real.
3. FULL SUITE. Run 'supabase test db' and the domain tests. Anything red is
   your next task, whether or not the queue knows about it.
4. STATE. Rewrite docs/ORCHESTRATION_STATE.md so a cold successor can take
   over from Git alone, and push.

Do the first of these that is not already clean. Commit and push what you
verify. Do not invent product work, do not touch another agent's owned_paths,
and do not claim a queue task — you already asked and there is none."
    exit 0 ;;
esac

# A real task was claimed — the queue is moving, so reset the standing counter.
rm -f "$STANDING_STATE" 2>/dev/null || true

id="$(printf '%s' "$task"    | jq -r '.id')"
title="$(printf '%s' "$task" | jq -r '.title')"
acc="$(printf '%s' "$task"   | jq -r '.acceptance_cmd // "pnpm lint && pnpm typecheck"')"
paths="$(printf '%s' "$task" | jq -r '(.owned_paths // []) | join(", ")')"
note="$(printf '%s' "$task"  | jq -r '.note // ""')"

emit_block "DO NOT STOP. You have been assigned the next task from the PAON fleet queue.

TASK_ID:     $id
TITLE:       $title
OWNED_PATHS: $paths
ACCEPTANCE:  $acc
${note:+NOTE:        $note}

RULES:
- You now hold an exclusive lease on this task. No other agent will touch it.
- Edit ONLY inside OWNED_PATHS. If you must change anything outside them, run
  'scripts/fleet/paon-fleet block $id \"needs <path>\"' and take the next task
  instead of widening your blast radius.
- Delegate recon/test-running/evidence to cheap Haiku subagents. Keep your own
  context for judgment. Do not read broadly yourself.
- Run ACCEPTANCE and see it genuinely pass. Never claim green you did not see.
- Then: commit, run 'scripts/fleet/paon-fleet done $id', and continue.
- Extend your lease with 'scripts/fleet/paon-fleet heartbeat $id' on long work.
- Do NOT add new features. Harden, wire and verify what already exists.

Begin now."
