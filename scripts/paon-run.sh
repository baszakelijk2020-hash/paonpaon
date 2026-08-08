#!/usr/bin/env bash
# Persistent, foreground-owned frontier loop for PAON.
#
# The repository is the handoff: each successful frontier turn exits, then a
# fresh turn cold-starts from AGENTS.md, PHASE.md, the Resume Protocol, Git,
# and the current worktree. A failed/interrupted noninteractive session is
# resumed by its exact session id while this process still owns the exclusive
# writer lock. Ctrl-C is the explicit stop mechanism.

set -uo pipefail

PROVIDER="${PAON_RUNNER_PROVIDER:-codex}"
MAX_TURNS="${PAON_RUNNER_MAX_TURNS:-0}"
DRY_RUN=0
MIN_TURN_SECONDS="${PAON_RUNNER_MIN_TURN_SECONDS:-30}"
MAX_RAPID_STALLS="${PAON_RUNNER_MAX_RAPID_STALLS:-4}"
MAX_FAILURES="${PAON_RUNNER_MAX_FAILURES:-5}"
BASE_BACKOFF_SECONDS="${PAON_RUNNER_BASE_BACKOFF_SECONDS:-15}"
MAX_BACKOFF_SECONDS="${PAON_RUNNER_MAX_BACKOFF_SECONDS:-300}"
CODEX_BIN="${PAON_RUNNER_CODEX_BIN:-codex}"
CLAUDE_BIN="${PAON_RUNNER_CLAUDE_BIN:-claude}"
SKIP_AUTH_CHECK="${PAON_RUNNER_SKIP_AUTH_CHECK:-0}"

usage() {
  cat <<'USAGE'
Usage: pnpm paon:run -- [--provider codex|claude] [--max-turns N] [--dry-run]

  --provider    Frontier CLI. Defaults to codex.
  --max-turns   Stop cleanly after N invocations. 0 means keep running.
  --dry-run     Validate repository, lock, CLI, auth, and unattended settings
                without invoking a model.

Run this foreground process once from the authorized PAON task branch. Stop
it explicitly with Ctrl-C.
USAGE
}

need_value() {
  if [ "$#" -lt 2 ] || [ -z "${2:-}" ]; then
    echo "Missing value for $1" >&2
    usage
    exit 64
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      ;;
    --provider)
      need_value "$@"
      PROVIDER="$2"
      shift 2
      ;;
    --max-turns)
      need_value "$@"
      MAX_TURNS="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 64
      ;;
  esac
done

case "$PROVIDER" in
  codex | claude) ;;
  *)
    echo "Unknown provider '$PROVIDER'. Use codex or claude." >&2
    exit 64
    ;;
esac

for numeric_value in "$MAX_TURNS" "$MIN_TURN_SECONDS" "$MAX_RAPID_STALLS" "$MAX_FAILURES" "$BASE_BACKOFF_SECONDS" "$MAX_BACKOFF_SECONDS"; do
  case "$numeric_value" in
    '' | *[!0-9]*)
      echo "Runner limits must be non-negative integers." >&2
      exit 64
      ;;
  esac
done

for required_command in git jq shasum hostname tee; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "Required command is missing: $required_command" >&2
    exit 69
  fi
done

if ! REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Run this command inside the PAON Git repository." >&2
  exit 69
fi
cd "$REPO_ROOT" || exit 69

GIT_DIR="$(git rev-parse --path-format=absolute --git-dir)"
GIT_COMMON_DIR="$(git rev-parse --path-format=absolute --git-common-dir)"
BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"

if [ -z "$BRANCH" ]; then
  echo "Hard blocker: PAON is on a detached HEAD. Check out the authorized task branch before starting the runner." >&2
  exit 2
fi

case "$BRANCH" in
  main | master)
    echo "Hard blocker: refusing unattended frontier writes on protected branch '$BRANCH'. Start from an authorized task/lane branch." >&2
    exit 2
    ;;
esac

git_operation() {
  if [ -f "$GIT_DIR/MERGE_HEAD" ]; then
    echo "merge"
  elif [ -f "$GIT_DIR/CHERRY_PICK_HEAD" ]; then
    echo "cherry-pick"
  elif [ -f "$GIT_DIR/REVERT_HEAD" ]; then
    echo "revert"
  elif [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ]; then
    echo "rebase"
  else
    echo ""
  fi
}

ACTIVE_GIT_OPERATION="$(git_operation)"
if [ -n "$ACTIVE_GIT_OPERATION" ]; then
  echo "Hard blocker: an unfinished Git $ACTIVE_GIT_OPERATION is already active. Resolve it before starting unattended work." >&2
  exit 2
fi

LOCK_NAME="${PAON_RUNNER_LOCK_NAME:-paon-frontier-runner.lock}"
case "$LOCK_NAME" in
  *[!A-Za-z0-9._-]* | '' | '.' | '..')
    echo "Invalid PAON_RUNNER_LOCK_NAME." >&2
    exit 64
    ;;
esac
LOCK_DIR="$GIT_COMMON_DIR/$LOCK_NAME"
RUNTIME_DIR="${PAON_RUNNER_RUNTIME_DIR:-$GIT_COMMON_DIR/paon-frontier-runner}"
LOG_DIR="$RUNTIME_DIR/logs"
CURRENT_HOST="$(hostname)"
LOCK_OWNED=0

release_lock() {
  if [ "$LOCK_OWNED" -ne 1 ]; then
    return
  fi
  case "$LOCK_DIR" in
    "$GIT_COMMON_DIR"/*) ;;
    *) return ;;
  esac
  for lock_file in pid host worktree branch provider started_at; do
    if [ -f "$LOCK_DIR/$lock_file" ]; then
      rm -f -- "$LOCK_DIR/$lock_file"
    fi
  done
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

stop_runner() {
  echo >&2
  echo "Explicit stop received; leaving the current branch and dirty state untouched." >&2
  exit 130
}

trap release_lock EXIT
trap stop_runner INT TERM HUP

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  LOCK_PID="$(cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  LOCK_HOST="$(cat "$LOCK_DIR/host" 2>/dev/null || true)"
  LOCK_WORKTREE="$(cat "$LOCK_DIR/worktree" 2>/dev/null || true)"
  if [ "$LOCK_HOST" = "$CURRENT_HOST" ] && [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "Hard blocker: frontier writer PID $LOCK_PID already owns PAON from $LOCK_WORKTREE. Stop that runner before starting another." >&2
    exit 2
  fi
  STALE_LOCK="$GIT_COMMON_DIR/${LOCK_NAME}.stale.$(date +%Y%m%d%H%M%S).$$"
  if ! mv "$LOCK_DIR" "$STALE_LOCK" 2>/dev/null || ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "Hard blocker: the shared frontier lock exists and could not be safely replaced: $LOCK_DIR" >&2
    exit 2
  fi
  echo "Recovered stale frontier lock as $STALE_LOCK" >&2
fi

LOCK_OWNED=1
printf '%s\n' "$$" >"$LOCK_DIR/pid"
printf '%s\n' "$CURRENT_HOST" >"$LOCK_DIR/host"
printf '%s\n' "$REPO_ROOT" >"$LOCK_DIR/worktree"
printf '%s\n' "$BRANCH" >"$LOCK_DIR/branch"
printf '%s\n' "$PROVIDER" >"$LOCK_DIR/provider"
date -u +%Y-%m-%dT%H:%M:%SZ >"$LOCK_DIR/started_at"
mkdir -p "$LOG_DIR"

check_codex() {
  if ! command -v "$CODEX_BIN" >/dev/null 2>&1; then
    echo "Codex CLI is not installed or not on PATH: $CODEX_BIN" >&2
    return 1
  fi
  if [ "$SKIP_AUTH_CHECK" != "1" ]; then
    if ! "$CODEX_BIN" login status 2>&1 | grep -q "Logged in"; then
      echo "Codex authentication is unavailable. Run: codex login" >&2
      return 1
    fi
    CODEX_CONFIG="${CODEX_HOME:-$HOME/.codex}/config.toml"
    if [ ! -f "$CODEX_CONFIG" ] || ! grep -Eq '^[[:space:]]*approval_policy[[:space:]]*=[[:space:]]*"never"' "$CODEX_CONFIG" || ! grep -Eq '^[[:space:]]*sandbox_mode[[:space:]]*=[[:space:]]*"danger-full-access"' "$CODEX_CONFIG"; then
      echo "Codex is not configured for unattended PAON writes. Set approval_policy=\"never\" and sandbox_mode=\"danger-full-access\" in ~/.codex/config.toml, then restart." >&2
      return 1
    fi
  fi
}

check_claude() {
  if ! command -v "$CLAUDE_BIN" >/dev/null 2>&1; then
    echo "Claude CLI is not installed or not on PATH: $CLAUDE_BIN" >&2
    return 1
  fi
  if [ "$SKIP_AUTH_CHECK" != "1" ]; then
    if ! "$CLAUDE_BIN" auth status --json 2>/dev/null | jq -e '.loggedIn == true' >/dev/null 2>&1; then
      echo "Claude authentication is unavailable. Run: claude auth login" >&2
      return 1
    fi
  fi
}

if [ "$PROVIDER" = "codex" ]; then
  check_codex || exit 3
else
  check_claude || exit 3
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "PAON unattended runner preflight passed."
  echo "Provider: $PROVIDER"
  echo "Branch: $BRANCH"
  echo "Worktree: $REPO_ROOT"
  echo "Shared lock: $LOCK_DIR"
  if [ "$PROVIDER" = "codex" ]; then
    echo "Invocation: codex exec --cd <PAON> --json --output-last-message <file> -"
  else
    echo "Invocation: claude -p --output-format stream-json --verbose --dangerously-skip-permissions <prompt>"
  fi
  exit 0
fi

repo_fingerprint() {
  {
    git symbolic-ref --quiet --short HEAD 2>/dev/null || true
    git rev-parse HEAD 2>/dev/null || true
    git status --porcelain=v2 -z --untracked-files=all 2>/dev/null || true
  } | shasum -a 256 | awk '{print $1}'
}

preserve_dirty_state() {
  local snapshot_dir="$1"
  mkdir -p "$snapshot_dir" || return 1
  git rev-parse HEAD >"$snapshot_dir/head" || return 1
  printf '%s\n' "$BRANCH" >"$snapshot_dir/branch" || return 1
  git status --porcelain=v2 -z --untracked-files=all >"$snapshot_dir/status.v2z" || return 1
  git diff --binary --no-ext-diff HEAD >"$snapshot_dir/tracked.patch" || return 1
  git ls-files --others --exclude-standard -z -- . ':(exclude).claude/worktrees/**' >"$snapshot_dir/untracked.list0" || return 1
  if [ -s "$snapshot_dir/untracked.list0" ]; then
    tar -cf "$snapshot_dir/untracked.tar" --null -T "$snapshot_dir/untracked.list0" || return 1
  fi
}

write_prompt() {
  local prompt_file="$1" turn_number="$2" resume_mode="$3"
  cat >"$prompt_file" <<PROMPT
You are the frontier seat for unattended PAON turn ${turn_number} on branch ${BRANCH}.

Continue from repository state, never from an assumed transcript. Read and obey AGENTS.md's Minimum context, the active item in docs/PHASE.md, the Resume Protocol, the named ADR/blueprint, Git status/log, and only directly relevant implementation and tests. Git, PHASE.md, ADRs, migrations, and tests are authority. Preserve every existing dirty or untracked file unless your authorized slice intentionally owns it.

Work continuously without asking the founder to paste "continue", approve routine commands, choose the next item, or relay worker output. Complete one coherent authorized slice, test and repair it, update authoritative state, commit intentionally, push only the current authorized task branch when safe, then take the next independent buildable item. Use the existing gpt-5.4-mini/Haiku cheap-worker delegation rules in AGENTS.md for every settled mechanical remainder; the frontier seat keeps architecture, security, RLS, money/stock, AI authorization, fidelity, and ambiguous decisions.

Never switch this primary worktree to another branch, reset/clean/rewrite history, remove a worktree, force-push, delete dirty state, update main/master, or bypass PHASE/ADR authority. Cheap-worker worktrees remain governed by AGENTS.md. Stop only for a genuine PHASE hard blocker, unresolved founder product decision, missing required external credential/access, irreversible action needing authorization, architectural contradiction, quota/auth exhaustion, or a completely exhausted authorized queue. A normal turn boundary, tool interruption, context pressure, or successful commit is not a blocker.

This invocation is running in ${resume_mode} mode. Before returning, leave Git and PHASE state coherent. End the final message with exactly one line:

PAON_RUNNER_STATUS: CONTINUE

Use PAON_RUNNER_STATUS: BLOCKED: <specific genuine blocker> only for one of the hard blockers above. Use PAON_RUNNER_STATUS: COMPLETE only when no authorized actionable work remains anywhere in PHASE.md. The outer runner automatically starts or resumes the next turn; never tell the founder to do that.
PROMPT
}

extract_codex_session() {
  jq -r 'select(.type == "thread.started") | .thread_id // empty' "$1" 2>/dev/null | tail -n 1
}

extract_claude_session() {
  jq -r 'select(.session_id != null) | .session_id' "$1" 2>/dev/null | tail -n 1
}

extract_claude_last_message() {
  jq -r 'select(.type == "result") | .result // empty' "$1" 2>/dev/null | tail -n 1
}

run_codex_turn() {
  local prompt_file="$1" log_file="$2" last_file="$3" resume_session="$4"
  if [ -n "$resume_session" ]; then
    "$CODEX_BIN" exec resume --json --output-last-message "$last_file" "$resume_session" - <"$prompt_file" 2>&1 | tee "$log_file"
  else
    "$CODEX_BIN" exec --cd "$REPO_ROOT" --json --color never --output-last-message "$last_file" - <"$prompt_file" 2>&1 | tee "$log_file"
  fi
  return "${PIPESTATUS[0]}"
}

run_claude_turn() {
  local prompt_file="$1" log_file="$2" last_file="$3" resume_session="$4"
  local prompt_text
  prompt_text="$(<"$prompt_file")"
  if [ -n "$resume_session" ]; then
    "$CLAUDE_BIN" -p --resume "$resume_session" --output-format stream-json --verbose --dangerously-skip-permissions "$prompt_text" 2>&1 | tee "$log_file"
  else
    "$CLAUDE_BIN" -p --output-format stream-json --verbose --dangerously-skip-permissions "$prompt_text" 2>&1 | tee "$log_file"
  fi
  local claude_exit="${PIPESTATUS[0]}"
  extract_claude_last_message "$log_file" >"$last_file"
  return "$claude_exit"
}

failure_is_quota_or_auth() {
  grep -Eqi 'usage limit|rate.?limit|quota|credit balance|exhausted|too many requests|(^|[^0-9])429([^0-9]|$)|unauthorized|authentication|auth token|oauth|login required|not logged in|invalid.*(key|token)|expired.*(key|token)' "$1"
}

status_from_last_message() {
  local last_file="$1"
  if grep -Eq '^PAON_RUNNER_STATUS:[[:space:]]*BLOCKED([[:space:]:].*)?$' "$last_file" 2>/dev/null; then
    echo "blocked"
  elif grep -Eq '^PAON_RUNNER_STATUS:[[:space:]]*COMPLETE[[:space:]]*$' "$last_file" 2>/dev/null; then
    echo "complete"
  else
    echo "continue"
  fi
}

backoff_seconds() {
  local failures="$1" delay="$BASE_BACKOFF_SECONDS" i=1
  while [ "$i" -lt "$failures" ]; do
    delay=$((delay * 2))
    if [ "$delay" -ge "$MAX_BACKOFF_SECONDS" ]; then
      delay="$MAX_BACKOFF_SECONDS"
      break
    fi
    i=$((i + 1))
  done
  echo "$delay"
}

echo "PAON unattended frontier runner started."
echo "Provider: $PROVIDER | branch: $BRANCH | stop: Ctrl-C"
echo "Existing dirty state is preserved and included in every repository-state handoff."

turn=0
failures=0
rapid_stalls=0
resume_session=""

while :; do
  turn=$((turn + 1))
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  prompt_file="$(mktemp "$RUNTIME_DIR/prompt.XXXXXX")"
  last_file="$(mktemp "$RUNTIME_DIR/last-message.XXXXXX")"
  log_file="$LOG_DIR/${stamp}-${PROVIDER}-turn-${turn}.jsonl"
  snapshot_dir="$RUNTIME_DIR/snapshots/${stamp}-turn-${turn}"

  if [ -n "$resume_session" ]; then
    resume_mode="safe resume of interrupted session $resume_session"
  else
    resume_mode="fresh cold-start from repository state"
  fi
  write_prompt "$prompt_file" "$turn" "$resume_mode"

  if ! preserve_dirty_state "$snapshot_dir"; then
    echo "Hard blocker: could not preserve the pre-turn dirty-state recovery snapshot at $snapshot_dir. No frontier model was invoked." >&2
    exit 2
  fi

  before_fingerprint="$(repo_fingerprint)"
  started_epoch="$(date +%s)"
  echo "Starting $PROVIDER frontier turn $turn ($resume_mode)."
  echo "Recovery snapshot: $snapshot_dir"

  set +e
  if [ "$PROVIDER" = "codex" ]; then
    run_codex_turn "$prompt_file" "$log_file" "$last_file" "$resume_session"
    turn_exit=$?
    discovered_session="$(extract_codex_session "$log_file")"
  else
    run_claude_turn "$prompt_file" "$log_file" "$last_file" "$resume_session"
    turn_exit=$?
    discovered_session="$(extract_claude_session "$log_file")"
  fi
  set -e

  rm -f -- "$prompt_file" "$last_file.tmp" 2>/dev/null || true
  finished_epoch="$(date +%s)"
  duration=$((finished_epoch - started_epoch))
  after_fingerprint="$(repo_fingerprint)"

  current_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [ "$current_branch" != "$BRANCH" ]; then
    echo "Hard blocker: the frontier changed the primary worktree branch from '$BRANCH' to '$current_branch'. No destructive recovery was attempted." >&2
    exit 2
  fi
  ACTIVE_GIT_OPERATION="$(git_operation)"
  if [ -n "$ACTIVE_GIT_OPERATION" ]; then
    echo "Hard blocker: frontier turn left an unfinished Git $ACTIVE_GIT_OPERATION. Repository state was preserved for deliberate recovery." >&2
    exit 2
  fi

  if [ "$turn_exit" -ne 0 ]; then
    if failure_is_quota_or_auth "$log_file"; then
      echo "Hard stop: $PROVIDER reported quota/auth exhaustion. Repository state and logs were preserved: $log_file" >&2
      exit 3
    fi
    failures=$((failures + 1))
    if [ -n "$discovered_session" ]; then
      resume_session="$discovered_session"
    fi
    if [ "$failures" -ge "$MAX_FAILURES" ]; then
      echo "Hard blocker: $failures consecutive frontier failures tripped the rapid-failure circuit breaker. Last log: $log_file" >&2
      exit 2
    fi
    delay="$(backoff_seconds "$failures")"
    echo "Frontier turn exited $turn_exit; preserving state and retrying${resume_session:+ session $resume_session} after ${delay}s."
    if [ "$delay" -gt 0 ]; then
      sleep "$delay"
    fi
  else
    failures=0
    resume_session=""
    final_status="$(status_from_last_message "$last_file")"
    if [ "$final_status" = "blocked" ]; then
      echo "Hard blocker reported by frontier. Last message:"
      cat "$last_file"
      exit 2
    fi
    if [ "$final_status" = "complete" ]; then
      echo "PAON frontier reports the authorized queue complete."
      exit 0
    fi

    if [ "$before_fingerprint" = "$after_fingerprint" ] && [ "$duration" -lt "$MIN_TURN_SECONDS" ]; then
      rapid_stalls=$((rapid_stalls + 1))
      echo "No repository progress in a rapid ${duration}s turn ($rapid_stalls/$MAX_RAPID_STALLS)."
      if [ "$rapid_stalls" -ge "$MAX_RAPID_STALLS" ]; then
        echo "Hard blocker: repeated rapid no-progress exits tripped the loop circuit breaker. Last log: $log_file" >&2
        exit 2
      fi
      delay="$(backoff_seconds "$rapid_stalls")"
      if [ "$delay" -gt 0 ]; then
        sleep "$delay"
      fi
    else
      rapid_stalls=0
    fi
  fi

  if [ "$MAX_TURNS" -gt 0 ] && [ "$turn" -ge "$MAX_TURNS" ]; then
    echo "Bounded run completed after $turn turn(s)."
    exit 0
  fi
done
