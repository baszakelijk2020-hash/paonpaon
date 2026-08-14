#!/usr/bin/env bash
# launch-fleet.sh — start all 5 PAON agents INSIDE tmux, each WITH a task.
#
# THE TWO BUGS THIS REPLACES
#   ~/.config/paon-agent-launcher/.vscode/tasks.json launched all five agents
#   with (a) no prompt — so they sat at an idle prompt with no work — and
#   (b) in plain VS Code terminals, not tmux. Every watchdog/cron scans
#   `tmux list-panes`, so 4 of 5 agents were structurally unreachable by the
#   supervision that was supposed to keep them working.
#
# Every agent here is launched in a named tmux session with an opening
# instruction that immediately pulls real work from the shared atomic queue.
set -euo pipefail

REPO_ROOT="${PAON_REPO_ROOT:-/Users/nguyen/Projects/PAON}"
FLEET="$REPO_ROOT/scripts/fleet/paon-fleet"

# agent_id | worktree | tmux session | tiers it may claim | launch command
AGENTS=(
  "claude-nguyen1|/private/tmp/paon-claude-nguyen1|paon-claude-nguyen1|frontier,implementation|claude --permission-mode bypassPermissions"
  "claude-nguyen2|/private/tmp/paon-claude-nguyen2|paon-claude-nguyen2|frontier,implementation|claude --permission-mode bypassPermissions"
  "claude-nguyen3|/private/tmp/paon-claude-nguyen3|paon-claude-nguyen3|implementation,light|claude --permission-mode bypassPermissions"
  "codex-openrouter|/private/tmp/paon-codex-openrouter|paon-codex|implementation,light|codex --dangerously-bypass-approvals-and-sandbox"
  "openrouter-deepseek|/private/tmp/paon-openrouter-codex|paon-deepseek|light|codex --dangerously-bypass-approvals-and-sandbox"
)

OPENING_PROMPT='You are a PAON fleet agent. Read AGENTS.md first.

Get your work from the shared atomic queue, never by reading docs/PHASE.md
yourself:

    scripts/fleet/paon-fleet take

That atomically claims the highest-priority task and gives you an exclusive
lease, so no other agent can take it. Then:

  - Edit ONLY inside the OWNED_PATHS the task names.
  - Delegate recon, test runs and evidence to cheap Haiku subagents; keep your
    own context for judgment.
  - Run the ACCEPTANCE command and genuinely see it pass. Never claim green
    you did not observe.
  - Commit, then: scripts/fleet/paon-fleet done <TASK_ID>
  - Then immediately: scripts/fleet/paon-fleet take   (do not idle, ever)
  - Long task? scripts/fleet/paon-fleet heartbeat <TASK_ID> to hold the lease.
  - Blocked or need a path you do not own?
        scripts/fleet/paon-fleet block <TASK_ID> "reason"
    then take the next task. Do NOT widen your blast radius and do NOT sit idle.

CURRENT DIRECTIVE: do not add new features. Harden, wire, verify and prove what
already exists, so the platform is sellable to a paying retailer.

Start now: run `scripts/fleet/paon-fleet take`.'

start_one() {
  IFS='|' read -r id wt sess tiers cmd <<< "$1"
  if [ ! -d "$wt" ]; then echo "  SKIP $id (missing worktree $wt)"; return; fi
  if tmux has-session -t "$sess" 2>/dev/null; then
    echo "  RUNNING $id (tmux: $sess) — leaving alone"; return
  fi
  tmux new-session -d -s "$sess" -c "$wt" \
    "PAON_AGENT_ID='$id' PAON_AGENT_TIERS='$tiers' PAON_REPO_ROOT='$REPO_ROOT' $cmd"
  sleep 3
  tmux send-keys -t "$sess" "$OPENING_PROMPT" C-m
  echo "  STARTED $id -> tmux:$sess  tiers=[$tiers]"
}

case "${1:-start}" in
  start)
    echo "=== PAON fleet: starting ==="
    "$FLEET" reap >/dev/null 2>&1 || true
    for a in "${AGENTS[@]}"; do start_one "$a"; done
    echo; "$FLEET" status
    ;;
  stop)
    for a in "${AGENTS[@]}"; do
      IFS='|' read -r id wt sess tiers cmd <<< "$a"
      tmux kill-session -t "$sess" 2>/dev/null && echo "  stopped $id" || true
    done
    ;;
  status)
    echo "=== tmux sessions ==="; tmux list-sessions 2>/dev/null || echo "(none)"
    echo; "$FLEET" status
    ;;
  nudge) # re-send the opening prompt to any agent sitting idle
    for a in "${AGENTS[@]}"; do
      IFS='|' read -r id wt sess tiers cmd <<< "$a"
      tmux has-session -t "$sess" 2>/dev/null || continue
      tmux send-keys -t "$sess" "$OPENING_PROMPT" C-m
      echo "  nudged $id"
    done
    ;;
  *) echo "usage: launch-fleet.sh {start|stop|status|nudge}"; exit 1 ;;
esac
