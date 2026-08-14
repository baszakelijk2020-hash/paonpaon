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
  emit_block "STOP BLOCKED — you have uncommitted work. Commit it now with a conventional message (prefix 'WIP:' if unfinished), then stop. Never leave the tree dirty for the next agent. Uncommitted:
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
[ -n "$task" ] && [ "$task" != "QUEUE_EMPTY" ] || exit 0

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
