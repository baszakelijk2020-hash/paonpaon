#!/usr/bin/env bash
# PreToolUse enforcement for AGENTS.md Route A/B/C delegation policy.
#
# Two invocation modes:
#   1. Hook mode (no args): Claude Code pipes a PreToolUse JSON payload on
#      stdin. We classify the tool call, update the repository-local
#      delegation ledger, and emit a deny decision once the frontier has
#      exceeded its un-delegated investigation budget.
#   2. CLI mode (--acknowledge-route-c "<reason>"): lets the frontier log an
#      explicit, auditable justification for narrow Route-C inspection and
#      draw a temporary grant instead of delegating. This is intentionally
#      friction-y (it requires a real written reason) so it can't become a
#      silent bypass.
#
# The ledger is ephemeral runtime state, not source of truth — it is
# gitignored. Losing it just resets the investigation budget to zero.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_FILE="${PAON_DELEGATION_STATE_FILE:-$REPO_ROOT/.claude/delegation-state.json}"
AUDIT_LOG="${PAON_DELEGATION_AUDIT_LOG:-$REPO_ROOT/.claude/delegation-audit.log}"
INVESTIGATION_LIMIT="${PAON_DELEGATION_INVESTIGATION_LIMIT:-6}"
ROUTE_C_GRANT="${PAON_DELEGATION_ROUTE_C_GRANT:-6}"

now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    mkdir -p "$(dirname "$STATE_FILE")"
    printf '%s\n' '{"investigationCount":0,"grantRemaining":0,"lastDelegatedAgent":null,"lastDelegatedAt":null}' >"$STATE_FILE"
  fi
}

read_state() {
  init_state
  cat "$STATE_FILE"
}

write_state() {
  mkdir -p "$(dirname "$STATE_FILE")"
  printf '%s' "$1" >"$STATE_FILE"
}

audit() {
  mkdir -p "$(dirname "$AUDIT_LOG")"
  printf '%s %s\n' "$(now)" "$1" >>"$AUDIT_LOG"
}

allow() {
  exit 0
}

deny() {
  local reason="$1"
  printf '%s\n' "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":$(printf '%s' "$reason" | jq -Rs .)}}"
  exit 0
}

# --- CLI mode -----------------------------------------------------------
if [ "${1:-}" = "--acknowledge-route-c" ]; then
  reason="${2:-}"
  if [ -z "$reason" ]; then
    echo "usage: delegation-gate.sh --acknowledge-route-c \"<reason>\"" >&2
    exit 64
  fi
  state="$(read_state)"
  new_state="$(printf '%s' "$state" | jq --argjson grant "$ROUTE_C_GRANT" '.grantRemaining = ((.grantRemaining // 0) + $grant) | .investigationCount = 0')"
  write_state "$new_state"
  audit "GRANT reason=$(printf '%s' "$reason" | tr '\n' ' ') budget=$ROUTE_C_GRANT"
  echo "Route-C grant recorded: +$ROUTE_C_GRANT investigative calls. Reason logged to .claude/delegation-audit.log."
  exit 0
fi

if [ "${1:-}" = "--reset" ]; then
  write_state '{"investigationCount":0,"grantRemaining":0,"lastDelegatedAgent":null,"lastDelegatedAt":null}'
  audit "MANUAL_RESET"
  exit 0
fi

# --- Hook mode ------------------------------------------------------------
payload="$(cat)"
tool_name="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"
agent_id="$(printf '%s' "$payload" | jq -r '.agent_id // empty')"

[ -n "$tool_name" ] || allow

# Tool calls carrying agent_id/agent_type originate INSIDE an already-
# dispatched subagent (a Route-A/B worker), not from the frontier's own
# direct tool use — the frontier and its workers share one session_id, so
# agent_id is the only reliable signal that distinguishes them. A worker's
# own investigation is the delegated work itself and must never be gated.
[ -z "$agent_id" ] || allow

case "$tool_name" in
  Agent)
    subagent="$(printf '%s' "$payload" | jq -r '.tool_input.subagent_type // "unknown"')"
    state="$(read_state)"
    new_state="$(printf '%s' "$state" | jq --arg agent "$subagent" --arg at "$(now)" \
      '.investigationCount = 0 | .grantRemaining = 0 | .lastDelegatedAgent = $agent | .lastDelegatedAt = $at')"
    write_state "$new_state"
    audit "DELEGATE agent=$subagent"
    allow
    ;;
  Read|Grep|Glob)
    ;;
  Bash)
    command="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"

    # Explicit, auditable Route-C acknowledgment call: always allowed, never
    # counted (the CLI-mode branch above performs the actual grant when this
    # command executes for real).
    if printf '%s' "$command" | grep -Eq '(^|[/[:space:]])scripts/delegation-gate\.sh --acknowledge-route-c'; then
      allow
    fi

    # Verification / acceptance / delegation / git-plumbing commands are
    # never Route-A investigation — never counted.
    if printf '%s' "$command" | grep -Eq '^(pnpm (lint|typecheck|test|test:e2e|build|format|format:check|validate:completion|exec|paon:|--filter)|turbo run|prettier|git (status|diff|log|show|add|push|pull|fetch|checkout|branch|commit|rev-parse|merge)|node |supabase |bash scripts/paon-|scripts/claude-stop-check\.sh)'; then
      if printf '%s' "$command" | grep -Eq '^git commit'; then
        state="$(read_state)"
        new_state="$(printf '%s' "$state" | jq '.investigationCount = 0 | .grantRemaining = 0')"
        write_state "$new_state"
        audit "COMMIT_BOUNDARY"
      fi
      allow
    fi

    # Bulk investigative shell commands count toward the same budget as
    # Read/Grep/Glob.
    if ! printf '%s' "$command" | grep -Eq '\b(grep|rg|ag|find|tree|sed -n|awk)\b'; then
      allow
    fi
    ;;
  *)
    allow
    ;;
esac

# Shared counting path for Read/Grep/Glob and classified investigative Bash.
state="$(read_state)"
grant_remaining="$(printf '%s' "$state" | jq -r '.grantRemaining // 0')"

if [ "$grant_remaining" -gt 0 ]; then
  new_state="$(printf '%s' "$state" | jq '.grantRemaining -= 1')"
  write_state "$new_state"
  allow
fi

count="$(printf '%s' "$state" | jq -r '.investigationCount // 0')"
count=$((count + 1))
new_state="$(printf '%s' "$state" | jq --argjson c "$count" '.investigationCount = $c')"
write_state "$new_state"

if [ "$count" -gt "$INVESTIGATION_LIMIT" ]; then
  audit "DENY tool=$tool_name count=$count"
  deny "Route-A investigation budget exceeded ($count un-delegated investigative calls). AGENTS.md's Hard delegation invariant / Route classification chapters: delegate this investigation to the paon-explorer or paon-test-investigator Haiku agent via the Agent tool before continuing. If this is genuinely bounded Route-C inspection (architecture/security/schema judgment), run: scripts/delegation-gate.sh --acknowledge-route-c \"<why this must be frontier-inspected>\" — this logs the justification to .claude/delegation-audit.log and grants a temporary allowance. Delegating (Task tool call) or committing (git commit) also resets this budget."
fi

allow
