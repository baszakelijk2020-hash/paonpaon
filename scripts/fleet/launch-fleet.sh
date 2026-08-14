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
#
# The DeepSeek lane MUST carry CODEX_HOME + OPENROUTER_API_KEY. The first
# version of this launcher dropped both (the original VS Code tasks.json had
# them), so the lane labelled "openrouter-deepseek" silently ran plain Codex
# on gpt-5.6-terra — burning the expensive quota the lane existed to avoid.
# Verified from the live pane before this fix: "gpt-5.6-terra medium".
# Exact query from the original tasks.json: account=$USER, service=OPENROUTER_API_KEY.
# (An earlier version of this file guessed `-s paon-openrouter`, which matches
# nothing.) codex-openrouter/config.toml declares env_key = "OPENROUTER_API_KEY",
# so Codex reads the key from that env var.
CODEX_OR_HOME="$HOME/.config/paon-agent-launcher/codex-openrouter"
OR_ENV="CODEX_HOME='$CODEX_OR_HOME' OPENROUTER_API_KEY=\"\$(security find-generic-password -a \"\$USER\" -s OPENROUTER_API_KEY -w 2>/dev/null)\""

# FAIL LOUD, never silently downgrade. If the key is missing the env var is
# empty and Codex quietly falls back to the signed-in ChatGPT account — so a
# lane you believe is cheap DeepSeek actually bills as gpt-5.6-terra. That is
# exactly what was happening: the keychain item does not exist on this machine.
preflight_openrouter() {
  if security find-generic-password -a "$USER" -s OPENROUTER_API_KEY -w >/dev/null 2>&1; then
    return 0
  fi
  cat >&2 <<'WARN'
  ✗ OPENROUTER_API_KEY missing from the login keychain.
    Expected: account=$USER  service=OPENROUTER_API_KEY
    Without it, `codex` silently falls back to your ChatGPT account, so the
    "openrouter-deepseek" lane bills as gpt-5.6-terra instead of DeepSeek.
    Add it with:
      security add-generic-password -a "$USER" -s OPENROUTER_API_KEY -w '<key>'
    Skipping this lane rather than starting it on the wrong (expensive) model.
WARN
  return 1
}

AGENTS=(
  "claude-nguyen1|/private/tmp/paon-claude-nguyen1|paon-claude-nguyen1|frontier,implementation|claude --permission-mode bypassPermissions"
  "claude-nguyen2|/private/tmp/paon-claude-nguyen2|paon-claude-nguyen2|frontier,implementation|claude --permission-mode bypassPermissions"
  "claude-nguyen3|/private/tmp/paon-claude-nguyen3|paon-claude-nguyen3|implementation,light|claude --permission-mode bypassPermissions"
  "codex-openrouter|/private/tmp/paon-codex-openrouter|paon-codex|implementation,light|codex --dangerously-bypass-approvals-and-sandbox"
  "openrouter-deepseek|/private/tmp/paon-openrouter-codex|paon-deepseek|light|$OR_ENV codex --dangerously-bypass-approvals-and-sandbox"
)

# Claude Code hooks (delegation gate, prettier, stop-continue) are Claude-only.
# Codex/OpenRouter sessions were inheriting them and failing every tool call
# with "PreToolUse hook (failed) exit 127". Non-Claude lanes get this marker so
# the hook scripts no-op instead of erroring.
NON_CLAUDE_ENV="PAON_NON_CLAUDE_AGENT=1"

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
  # Refuse to start the OpenRouter lane on the wrong model.
  if [ "$id" = "openrouter-deepseek" ] && ! preflight_openrouter; then
    echo "  SKIPPED $id (no OpenRouter key — would have run as expensive Codex)"
    return
  fi
  local extra=""
  case "$cmd" in *codex*) extra="$NON_CLAUDE_ENV " ;; esac
  tmux new-session -d -s "$sess" -c "$wt" \
    "${extra}PAON_AGENT_ID='$id' PAON_AGENT_TIERS='$tiers' PAON_REPO_ROOT='$REPO_ROOT' $cmd"
  sleep 6   # both CLIs need time to finish booting before they accept input
  # A multi-line string arrives as a bracketed PASTE, which these TUIs buffer
  # as a "[Pasted text]" block rather than submitting. The trailing C-m only
  # closes the paste; a SECOND, separate Enter is what actually submits it.
  # Found the hard way: the first fleet launch left every agent sitting on an
  # unsubmitted prompt, looking launched but doing nothing.
  tmux send-keys -t "$sess" "$OPENING_PROMPT"
  sleep 2
  tmux send-keys -t "$sess" C-m
  sleep 1
  tmux send-keys -t "$sess" C-m
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
      tmux send-keys -t "$sess" "$OPENING_PROMPT"
      sleep 2; tmux send-keys -t "$sess" C-m
      sleep 1; tmux send-keys -t "$sess" C-m
      echo "  nudged $id"
    done
    ;;
  *) echo "usage: launch-fleet.sh {start|stop|status|nudge}"; exit 1 ;;
esac
