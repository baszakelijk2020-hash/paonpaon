#!/usr/bin/env bash
# Tests scripts/delegation-gate.sh — the PreToolUse Route A/B/C delegation
# enforcement hook. Pure bash + jq, no framework, matching the convention of
# scripts/paon-runner.test.sh.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$REPO_ROOT/scripts/delegation-gate.sh"
TEST_DIR="$(mktemp -d)"
export PAON_DELEGATION_STATE_FILE="$TEST_DIR/state.json"
export PAON_DELEGATION_AUDIT_LOG="$TEST_DIR/audit.log"
export PAON_DELEGATION_INVESTIGATION_LIMIT=3
export PAON_DELEGATION_ROUTE_C_GRANT=2

cleanup() { rm -rf -- "$TEST_DIR"; }
trap cleanup EXIT

fail_count=0

assert() {
  local desc="$1"
  local ok="$2"
  if [ "$ok" = "0" ]; then
    echo "ok   - $desc"
  else
    echo "FAIL - $desc"
    fail_count=$((fail_count + 1))
  fi
}

reset_ledger() {
  "$GATE" --reset >/dev/null
}

call_hook() {
  # $1 = JSON payload
  printf '%s' "$1" | "$GATE"
}

read_payload() {
  local tool="$1" input="$2"
  printf '{"tool_name":"%s","tool_input":%s}' "$tool" "$input"
}

# --- 1. Un-delegated Route-A investigation is eventually rejected ---------
reset_ledger
out=""
for i in 1 2 3; do
  out="$(call_hook "$(read_payload Grep '{"pattern":"foo"}')")"
done
# limit=3: the 3rd call should still be allowed (count == limit, not > limit)
assert "3rd un-delegated Grep call still allowed at the limit" "$([ -z "$out" ] && echo 0 || echo 1)"

out="$(call_hook "$(read_payload Grep '{"pattern":"foo"}')")"
denied="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)"
assert "4th un-delegated Grep call is denied" "$([ "$denied" = "deny" ] && echo 0 || echo 1)"

# --- 2. Haiku-delegated Route-A work resets the budget and permits
#        subsequent frontier verification -----------------------------------
reset_ledger
for i in 1 2 3 4 5; do
  call_hook "$(read_payload Grep '{"pattern":"foo"}')" >/dev/null
done
out="$(call_hook "$(read_payload Grep '{"pattern":"foo"}')")"
denied="$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)"
assert "budget exhausted before delegation" "$([ "$denied" = "deny" ] && echo 0 || echo 1)"

call_hook "$(read_payload Task '{"subagent_type":"paon-explorer"}')" >/dev/null
agent="$(jq -r '.lastDelegatedAgent' "$PAON_DELEGATION_STATE_FILE")"
assert "ledger records the delegated agent" "$([ "$agent" = "paon-explorer" ] && echo 0 || echo 1)"

out="$(call_hook "$(read_payload Read '{"file_path":"AGENTS.md"}')")"
assert "Sonnet's post-delegation verification read is permitted" "$([ -z "$out" ] && echo 0 || echo 1)"

# --- 3. Route-C narrow inspection / final acceptance is never blocked -----
reset_ledger
out="$(call_hook "$(read_payload Bash '{"command":"pnpm --filter @paon/domain typecheck"}')")"
assert "typecheck acceptance command is never gated" "$([ -z "$out" ] && echo 0 || echo 1)"

out="$(call_hook "$(read_payload Bash '{"command":"pnpm test"}')")"
assert "test acceptance command is never gated" "$([ -z "$out" ] && echo 0 || echo 1)"

for i in 1 2 3; do
  call_hook "$(read_payload Bash '{"command":"pnpm lint"}')" >/dev/null
done
out="$(call_hook "$(read_payload Bash '{"command":"pnpm build"}')")"
assert "repeated verification commands never accumulate toward the budget" "$([ -z "$out" ] && echo 0 || echo 1)"

# git commit closes a unit of work and resets the budget
reset_ledger
for i in 1 2 3; do
  call_hook "$(read_payload Grep '{"pattern":"foo"}')" >/dev/null
done
call_hook "$(read_payload Bash '{"command":"git commit -m \"x\""}')" >/dev/null
count="$(jq -r '.investigationCount' "$PAON_DELEGATION_STATE_FILE")"
assert "git commit resets the investigation counter" "$([ "$count" = "0" ] && echo 0 || echo 1)"

# explicit, auditable Route-C acknowledgment grants a temporary allowance
reset_ledger
for i in 1 2 3; do
  call_hook "$(read_payload Read '{"file_path":"x"}')" >/dev/null
done
"$GATE" --acknowledge-route-c "inspecting 4 migrations for a schema decision" >/dev/null
audit_line="$(tail -n 1 "$PAON_DELEGATION_AUDIT_LOG")"
assert "acknowledgment is written to the audit log" "$(printf '%s' "$audit_line" | grep -q "GRANT reason=" && echo 0 || echo 1)"
out="$(call_hook "$(read_payload Read '{"file_path":"y"}')")"
assert "acknowledged Route-C inspection is permitted" "$([ -z "$out" ] && echo 0 || echo 1)"

# --- 4. Non-investigative / non-matched tool calls are never touched ------
reset_ledger
out="$(call_hook '{"tool_name":"Edit","tool_input":{"file_path":"x"}}')"
assert "Edit tool calls are never gated" "$([ -z "$out" ] && echo 0 || echo 1)"

out="$(call_hook "$(read_payload Bash '{"command":"echo hello"}')")"
assert "unclassified benign Bash commands are never gated" "$([ -z "$out" ] && echo 0 || echo 1)"

# --- 5. Existing repository delegation script is untouched ----------------
assert "scripts/paon-delegate.sh still present and executable" "$([ -x "$REPO_ROOT/scripts/paon-delegate.sh" ] && echo 0 || echo 1)"
assert "scripts/claude-stop-check.sh still present and executable" "$([ -x "$REPO_ROOT/scripts/claude-stop-check.sh" ] && echo 0 || echo 1)"

echo "---"
if [ "$fail_count" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$fail_count FAILURE(S)"
  exit 1
fi
