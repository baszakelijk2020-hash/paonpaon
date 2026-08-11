#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
RUNNER="$REPO_ROOT/scripts/paon-run.sh"
TEST_DIR="$(mktemp -d)"
LOCK_NAME="paon-frontier-runner-test-$$.lock"
BEFORE="$(git -C "$REPO_ROOT" status --porcelain=v2 -z --untracked-files=all | shasum -a 256 | awk '{print $1}')"

cleanup() {
  if [ -n "${LOCK_HOLDER_PID:-}" ]; then
    kill "$LOCK_HOLDER_PID" 2>/dev/null || true
  fi
  rm -rf -- "$TEST_DIR"
}
trap cleanup EXIT

cat >"$TEST_DIR/codex" <<'STUB'
#!/usr/bin/env bash
set -u
if [ "${1:-}" = "login" ]; then
  echo "Logged in using test"
  exit 0
fi
last_file=""
resume_seen=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output-last-message|-o) last_file="$2"; shift 2 ;;
    resume) resume_seen=1; shift ;;
    *) shift ;;
  esac
done
count_file="${PAON_STUB_COUNT_FILE:?}"
count="$(cat "$count_file" 2>/dev/null || echo 0)"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
echo "codex startup warning" >&2
printf '%s\n' '{"type":"thread.started","thread_id":"11111111-1111-1111-1111-111111111111"}'
if [ "$count" -eq 1 ] && [ "${PAON_STUB_FAIL_FIRST:-0}" = "1" ]; then
  exit 7
fi
if [ "${PAON_STUB_FAIL_FIRST:-0}" = "1" ] && [ "$resume_seen" -ne 1 ]; then
  echo "expected codex resume" >&2
  exit 8
fi
printf '%s\n' 'PAON_RUNNER_STATUS: COMPLETE' >"$last_file"
printf '%s\n' '{"type":"turn.completed"}'
STUB
chmod +x "$TEST_DIR/codex"

cat >"$TEST_DIR/claude" <<'STUB'
#!/usr/bin/env bash
set -u
if [ "${1:-}" = "auth" ]; then
  printf '%s\n' '{"loggedIn":true}'
  exit 0
fi
resume_seen=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --resume|-r) resume_seen=1; shift 2 ;;
    *) shift ;;
  esac
done
count_file="${PAON_STUB_COUNT_FILE:?}"
count="$(cat "$count_file" 2>/dev/null || echo 0)"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
echo "claude startup warning" >&2
printf '%s\n' '{"type":"system","subtype":"init","session_id":"22222222-2222-2222-2222-222222222222"}'
if [ "$count" -eq 1 ] && [ "${PAON_STUB_FAIL_FIRST:-0}" = "1" ]; then
  exit 7
fi
if [ "${PAON_STUB_FAIL_FIRST:-0}" = "1" ] && [ "$resume_seen" -ne 1 ]; then
  echo "expected claude resume" >&2
  exit 8
fi
printf '%s\n' '{"type":"result","session_id":"22222222-2222-2222-2222-222222222222","result":"PAON_RUNNER_STATUS: COMPLETE"}'
STUB
chmod +x "$TEST_DIR/claude"

run_stubbed() {
  local provider="$1" bin="$2" output="$3"
  : >"$TEST_DIR/$provider-count"
  PAON_RUNNER_CODEX_BIN="$bin" \
  PAON_RUNNER_CLAUDE_BIN="$bin" \
  PAON_RUNNER_SKIP_AUTH_CHECK=1 \
  PAON_RUNNER_RUNTIME_DIR="$TEST_DIR/runtime-$provider" \
  PAON_RUNNER_LOCK_NAME="$LOCK_NAME-$provider" \
  PAON_RUNNER_BASE_BACKOFF_SECONDS=0 \
  PAON_RUNNER_MAX_BACKOFF_SECONDS=0 \
  PAON_STUB_COUNT_FILE="$TEST_DIR/$provider-count" \
  PAON_STUB_FAIL_FIRST=1 \
    bash "$RUNNER" --provider "$provider" >"$output" 2>&1
  grep -q "safe resume of interrupted session" "$output"
  grep -q "authorized queue complete" "$output"
  test "$(cat "$TEST_DIR/$provider-count")" -eq 2
  test -n "$(find "$TEST_DIR/runtime-$provider/snapshots" -name tracked.patch -print -quit)"
  test -n "$(find "$TEST_DIR/runtime-$provider/snapshots" -name status.v2z -print -quit)"
  find "$TEST_DIR/runtime-$provider/logs" -name '*.jsonl' -type f -exec jq -e . {} \; >/dev/null
  grep -q "startup warning" "$TEST_DIR/runtime-$provider/logs/"*.stderr.log
}

run_stubbed codex "$TEST_DIR/codex" "$TEST_DIR/codex.out"
run_stubbed claude "$TEST_DIR/claude" "$TEST_DIR/claude.out"

GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
CONCURRENT_LOCK="$GIT_COMMON_DIR/$LOCK_NAME-concurrent"
mkdir "$CONCURRENT_LOCK"
sleep 30 &
LOCK_HOLDER_PID=$!
printf '%s\n' "$LOCK_HOLDER_PID" >"$CONCURRENT_LOCK/pid"
hostname >"$CONCURRENT_LOCK/host"
printf '%s\n' "$REPO_ROOT" >"$CONCURRENT_LOCK/worktree"
set +e
PAON_RUNNER_CODEX_BIN="$TEST_DIR/codex" \
PAON_RUNNER_SKIP_AUTH_CHECK=1 \
PAON_RUNNER_RUNTIME_DIR="$TEST_DIR/runtime-lock" \
PAON_RUNNER_LOCK_NAME="$LOCK_NAME-concurrent" \
  bash "$RUNNER" --provider codex --dry-run >"$TEST_DIR/lock.out" 2>&1
lock_exit=$?
set -e
kill "$LOCK_HOLDER_PID" 2>/dev/null || true
wait "$LOCK_HOLDER_PID" 2>/dev/null || true
LOCK_HOLDER_PID=""
rm -f -- "$CONCURRENT_LOCK/pid" "$CONCURRENT_LOCK/host" "$CONCURRENT_LOCK/worktree"
rmdir "$CONCURRENT_LOCK"
test "$lock_exit" -eq 2
grep -q "frontier writer PID" "$TEST_DIR/lock.out"

# --- Automatic frontier context rollover (AGENTS.md ch.55) -----------------

# 1. The generated prompt carries the rollover guidance verbatim, so the
#    frontier model is actually told to self-monitor and end its turn at a
#    safe boundary rather than growing without bound.
cat >"$TEST_DIR/claude-capture" <<'STUB'
#!/usr/bin/env bash
set -u
if [ "${1:-}" = "auth" ]; then
  printf '%s\n' '{"loggedIn":true}'
  exit 0
fi
resume_seen=0
prompt_text=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --resume|-r) resume_seen=1; shift 2 ;;
    -p) shift ;;
    --output-format|--verbose|--dangerously-skip-permissions) shift ;;
    stream-json) shift ;;
    *) prompt_text="$1"; shift ;;
  esac
done
printf '%s' "$prompt_text" >"${PAON_STUB_PROMPT_CAPTURE:?}"
printf '%s\n' "$resume_seen" >"${PAON_STUB_RESUME_SEEN_FILE:?}"
count_file="${PAON_STUB_COUNT_FILE:?}"
count="$(cat "$count_file" 2>/dev/null || echo 0)"
count=$((count + 1))
printf '%s\n' "$count" >"$count_file"
printf '%s\n' '{"type":"system","subtype":"init","session_id":"33333333-3333-3333-3333-333333333333"}'
status="${PAON_STUB_STATUS_TURN1:-COMPLETE}"
if [ "$count" -gt 1 ]; then
  status="${PAON_STUB_STATUS_TURN2:-COMPLETE}"
fi
printf '%s\n' "{\"type\":\"result\",\"session_id\":\"33333333-3333-3333-3333-333333333333\",\"result\":\"PAON_RUNNER_STATUS: ${status}\"}"
STUB
chmod +x "$TEST_DIR/claude-capture"

: >"$TEST_DIR/rollover-count"
PAON_RUNNER_CLAUDE_BIN="$TEST_DIR/claude-capture" \
PAON_RUNNER_SKIP_AUTH_CHECK=1 \
PAON_RUNNER_RUNTIME_DIR="$TEST_DIR/runtime-rollover" \
PAON_RUNNER_LOCK_NAME="$LOCK_NAME-rollover" \
PAON_RUNNER_BASE_BACKOFF_SECONDS=0 \
PAON_RUNNER_MAX_BACKOFF_SECONDS=0 \
PAON_RUNNER_MAX_TURNS=1 \
PAON_STUB_COUNT_FILE="$TEST_DIR/rollover-count" \
PAON_STUB_PROMPT_CAPTURE="$TEST_DIR/prompt-turn1.txt" \
PAON_STUB_RESUME_SEEN_FILE="$TEST_DIR/resume-seen-turn1.txt" \
PAON_STUB_STATUS_TURN1="CONTINUE" \
  bash "$RUNNER" --provider claude >"$TEST_DIR/rollover.out" 2>&1

grep -qi "context rollover" "$TEST_DIR/prompt-turn1.txt"
grep -q "150k-200k" "$TEST_DIR/prompt-turn1.txt"
grep -q "CONTINUE, not STOP" "$TEST_DIR/prompt-turn1.txt"
grep -qi "do not write a conversation summary or handoff file" "$TEST_DIR/prompt-turn1.txt"

# 2. A successful CONTINUE turn (a deliberate rollover) makes the NEXT turn
#    start completely fresh — no --resume — even though a session id was
#    discovered from the prior turn's output. This is the mechanical half
#    of "a rollover is CONTINUE, not STOP": the outer loop must actually
#    cold-start the next turn rather than resuming the old conversation.
: >"$TEST_DIR/rollover2-count"
PAON_RUNNER_CLAUDE_BIN="$TEST_DIR/claude-capture" \
PAON_RUNNER_SKIP_AUTH_CHECK=1 \
PAON_RUNNER_RUNTIME_DIR="$TEST_DIR/runtime-rollover2" \
PAON_RUNNER_LOCK_NAME="$LOCK_NAME-rollover2" \
PAON_RUNNER_BASE_BACKOFF_SECONDS=0 \
PAON_RUNNER_MAX_BACKOFF_SECONDS=0 \
PAON_STUB_COUNT_FILE="$TEST_DIR/rollover2-count" \
PAON_STUB_PROMPT_CAPTURE="$TEST_DIR/prompt-turn2.txt" \
PAON_STUB_RESUME_SEEN_FILE="$TEST_DIR/resume-seen-turn2.txt" \
PAON_STUB_STATUS_TURN1="CONTINUE" \
PAON_STUB_STATUS_TURN2="COMPLETE" \
  bash "$RUNNER" --provider claude >"$TEST_DIR/rollover2.out" 2>&1

test "$(cat "$TEST_DIR/rollover2-count")" -eq 2
test "$(cat "$TEST_DIR/resume-seen-turn2.txt")" = "0"
grep -q "fresh cold-start from repository state" "$TEST_DIR/rollover2.out"
grep -q "authorized queue complete" "$TEST_DIR/rollover2.out"

# 3. An unfinished Git operation blocks the runner before any frontier
#    invocation — a rollover (or any turn) must never start mid-merge.
: >"$TEST_DIR/gitop-count"
GIT_DIR_FOR_TEST="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-dir)"
: >"$GIT_DIR_FOR_TEST/MERGE_HEAD"
set +e
PAON_RUNNER_CLAUDE_BIN="$TEST_DIR/claude-capture" \
PAON_RUNNER_SKIP_AUTH_CHECK=1 \
PAON_RUNNER_RUNTIME_DIR="$TEST_DIR/runtime-gitop" \
PAON_RUNNER_LOCK_NAME="$LOCK_NAME-gitop" \
PAON_STUB_COUNT_FILE="$TEST_DIR/gitop-count" \
  bash "$RUNNER" --provider claude >"$TEST_DIR/gitop.out" 2>&1
gitop_exit=$?
set -e
rm -f -- "$GIT_DIR_FOR_TEST/MERGE_HEAD"
test "$gitop_exit" -eq 2
grep -q "unfinished Git merge" "$TEST_DIR/gitop.out"
gitop_count="$(cat "$TEST_DIR/gitop-count" 2>/dev/null)"
test -z "$gitop_count"

# 4. No conversation-summary/handoff file is ever created by the runner —
#    repository state is the only authorized handoff mechanism.
if find "$TEST_DIR/runtime-rollover" "$TEST_DIR/runtime-rollover2" \
    \( -iname '*handoff*' -o -iname '*summary*' -o -iname '*transcript*' \) \
    -print -quit | grep -q .; then
  echo "Runner created a forbidden handoff/summary file." >&2
  exit 1
fi

AFTER="$(git -C "$REPO_ROOT" status --porcelain=v2 -z --untracked-files=all | shasum -a 256 | awk '{print $1}')"
test "$BEFORE" = "$AFTER"

echo "PAON runner tests passed for Codex, Claude, safe resume, exclusive locking, dirty-state preservation, and automatic context rollover."
