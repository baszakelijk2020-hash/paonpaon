#!/usr/bin/env bash
# PAON cheap-worker delegation bridge — see AGENTS.md "Cheap-worker delegation".
#
# Hands one bounded PHASE.md slice to a cheap worker (the already-installed
# `codex` CLI) inside an isolated git worktree, waits for it, independently
# re-verifies the result, and prints one JSON line the calling agent can act
# on. No task database, no scheduler, no daemon: one process, one exit.
#
# Two providers, same worktree/verify/JSON contract either way:
#   openrouter    (default) codex pointed at OpenRouter through a per-machine
#                 additive profile — the founder's own OpenAI/ChatGPT
#                 config.toml is never edited. Pay-per-token; needs
#                 OPENROUTER_API_KEY.
#   subscription  codex runs with whatever auth `codex login` already set up
#                 on this machine (a ChatGPT/Codex subscription) — no key,
#                 no profile file, no OpenRouter involved. Model must be one
#                 the subscription actually serves (check
#                 ~/.codex/models_cache.json); the light/mini tier there is
#                 the intended worker model, same spirit as the OpenRouter
#                 cheap-model default.
#
# Usage:
#   pnpm paon:delegate -- --item <PHASE_ID> --scope "<bounded task text>" \
#     --model <model-id> [--provider openrouter|subscription] \
#     [--branch <name>] [--base <ref>] [--timeout <seconds>]
#
# openrouter provider only: requires OPENROUTER_API_KEY in the environment.
# This script never reads it from, or writes it to, any file — codex
# resolves it at call time via the profile's command-based auth (see
# OpenRouter's own Codex CLI cookbook).

set -euo pipefail

ITEM=""
SCOPE=""
BRANCH=""
BASE_REF=""
MODEL="${PAON_DELEGATE_MODEL:-}"
PROVIDER="${PAON_DELEGATE_PROVIDER:-openrouter}"
TIMEOUT="${PAON_DELEGATE_TIMEOUT_SECONDS:-1800}"

while [ $# -gt 0 ]; do
  case "$1" in
    --) shift ;;
    --item) ITEM="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --base) BASE_REF="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

usage() {
  echo 'Usage: pnpm paon:delegate -- --item <PHASE_ID> --scope "<bounded task>" --model <model-id> [--provider openrouter|subscription] [--branch <name>] [--base <ref>] [--timeout <seconds>]' >&2
}

if [ -z "$ITEM" ] || [ -z "$SCOPE" ]; then
  usage
  exit 1
fi

case "$PROVIDER" in
  openrouter|subscription) ;;
  *) echo "Unknown --provider '$PROVIDER'. Use 'openrouter' or 'subscription'." >&2; exit 1 ;;
esac

# Same JSON shape as a full run for every pre-flight exit too, so a frontier
# agent parsing the result never has to special-case a stderr-only failure
# to decide the next backend.
preflight_fail() {
  local reason="$1" message="$2"
  echo "$message" >&2
  jq -n --arg reason "$reason" --arg item "$ITEM" --arg provider "$PROVIDER" \
    --arg model "$MODEL" --arg message "$message" \
    '{status:"blocked",reason:$reason,item:$item,branch:"",worktree:"",baseSha:"",resultSha:"",diffStat:"",verification:"skipped",workerLastMessage:"",stopReason:$message,model:$model,provider:$provider}'
  exit 2
}

if [ "$PROVIDER" = "openrouter" ] && [ -z "${OPENROUTER_API_KEY:-}" ]; then
  preflight_fail "missing_credential" "OPENROUTER_API_KEY is not set. Export it in your shell (never commit it) and retry, or pass --provider subscription to use the machine's own codex/ChatGPT login instead."
fi

if [ -z "$MODEL" ]; then
  preflight_fail "missing_model_config" "No worker model given. Pass --model <model-id> or set PAON_DELEGATE_MODEL — this script never assumes one for you. For --provider subscription, check ~/.codex/models_cache.json for the light/mini tier your login actually serves."
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found on PATH (npm i -g @openai/codex), or point this script at an equivalent headless OpenAI-compatible CLI." >&2
  exit 1
fi

# macOS ships no `timeout`(1). A hand-rolled background+kill fallback was
# tried and proved unreliable (job-control edge cases produced a silent
# full-length hang instead of an early return) — require the real binary
# rather than ship something that can hang a worker invocation undetected.
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
else
  echo "No 'timeout' binary found. On macOS: brew install coreutils (provides gtimeout)." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

ITEM_SLUG="$(echo "$ITEM" | tr -c 'a-zA-Z0-9' '-' | tr -s '-' | sed 's/^-//;s/-$//' | tr '[:upper:]' '[:lower:]')"
BRANCH="${BRANCH:-agent/lane-delegate-${ITEM_SLUG}-$(date +%Y%m%d%H%M%S)}"
BASE_REF="${BASE_REF:-$(git rev-parse --abbrev-ref HEAD)}"
WORKTREE_DIR=".claude/worktrees/delegate-${ITEM_SLUG}"

# --- isolated git scope, same convention as any other lane worktree ---
if [ -d "$WORKTREE_DIR" ]; then
  echo "Reusing existing worktree $WORKTREE_DIR ($(git -C "$WORKTREE_DIR" rev-parse --abbrev-ref HEAD))." >&2
else
  git worktree add "$WORKTREE_DIR" -b "$BRANCH" "$BASE_REF" >&2
fi
BASE_SHA="$(git -C "$WORKTREE_DIR" rev-parse HEAD)"
ACTUAL_BRANCH="$(git -C "$WORKTREE_DIR" rev-parse --abbrev-ref HEAD)"

# --- deps up front, so the sandboxed worker call below needs no network ---
(cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile) >&2

# --- provider setup ---
# openrouter: additive, non-secret profile, rewritten each run so a stale
# copy never lingers. Layers on top of the machine's own ~/.codex/config.toml
# via --profile below; that file is never edited. env_key + wire_api are
# verified live against openrouter.ai (a malformed key correctly produced a
# real 401 from OpenRouter itself, not a local config error) —
# wire_api="chat" is rejected by this codex build. subscription: no profile
# file at all — codex runs with whatever `codex login` already set up on
# this machine, untouched.
CODEX_PROFILE_ARGS=()
if [ "$PROVIDER" = "openrouter" ]; then
  CODEX_HOME_DIR="${CODEX_HOME:-$HOME/.codex}"
  PROFILE_PATH="$CODEX_HOME_DIR/paon-worker.config.toml"
  mkdir -p "$CODEX_HOME_DIR"
  cat > "$PROFILE_PATH" <<'TOML'
model_provider = "openrouter"

[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "responses"
TOML
  CODEX_PROFILE_ARGS=(--profile paon-worker)
fi

PROMPT_FILE="$(mktemp)"
LAST_MSG_FILE="$(mktemp)"
CODEX_LOG_FILE="$(mktemp)"
trap 'rm -f "$PROMPT_FILE" "$LAST_MSG_FILE" "$CODEX_LOG_FILE"' EXIT

cat > "$PROMPT_FILE" <<PROMPT
Repo: ${REPO_ROOT}/${WORKTREE_DIR}. Branch: ${ACTUAL_BRANCH}, already checked out.
Read AGENTS.md, then PHASE.md item ${ITEM} (only that item), then the ADR/blueprint
it names if any. Bounded task for this session, nothing more:

${SCOPE}

Do not touch RLS, migrations outside this item's own schema, money/stock/tenant
boundaries, AI-authorization logic, customer-data visibility, or anything marked
founder-decision-needed. If the bounded task above requires one of those, stop,
commit nothing, and end your final message with a line starting exactly
"BLOCKED: " followed by a one-sentence reason.
Run: pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check.
Commit only if every one of those is green, with a plain-language message. Do not
push, do not touch main, do not touch any file outside this bounded task.
PROMPT

set +e
"$TIMEOUT_BIN" "$TIMEOUT" codex exec \
  --cd "${REPO_ROOT}/${WORKTREE_DIR}" \
  --sandbox workspace-write \
  ${CODEX_PROFILE_ARGS[@]+"${CODEX_PROFILE_ARGS[@]}"} \
  -m "$MODEL" \
  --output-last-message "$LAST_MSG_FILE" \
  - < "$PROMPT_FILE" 2>&1 | tee "$CODEX_LOG_FILE" >&2
WORKER_EXIT="${PIPESTATUS[0]}"
set -e

RESULT_SHA="$(git -C "$WORKTREE_DIR" rev-parse HEAD)"
LAST_MESSAGE="$(cat "$LAST_MSG_FILE" 2>/dev/null || true)"
CODEX_LOG="$(cat "$CODEX_LOG_FILE" 2>/dev/null || true)"

# --- independent re-verification: never trust the worker's own claim ---
VERIFY_STATUS="skipped"
if [ "$RESULT_SHA" != "$BASE_SHA" ]; then
  if (cd "$WORKTREE_DIR" && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm format:check) >&2; then
    VERIFY_STATUS="pass"
  else
    VERIFY_STATUS="fail"
  fi
fi

DIFF_STAT="$(git -C "$WORKTREE_DIR" diff --stat "$BASE_SHA" "$RESULT_SHA" 2>/dev/null || true)"

STATUS="failed"
STOP_REASON=""
if [ "$RESULT_SHA" = "$BASE_SHA" ]; then
  STATUS="blocked"
  STOP_REASON="worker made no commit"
  if echo "$LAST_MESSAGE" | grep -q "^BLOCKED:"; then
    STOP_REASON="$(echo "$LAST_MESSAGE" | grep "^BLOCKED:" | head -1 | sed 's/^BLOCKED: *//')"
  fi
elif [ "$VERIFY_STATUS" = "pass" ] && [ "$WORKER_EXIT" -eq 0 ]; then
  STATUS="success"
else
  STATUS="failed"
  STOP_REASON="independent re-verification: ${VERIFY_STATUS}; codex exit ${WORKER_EXIT}"
fi

# --- machine-readable reason, so a frontier agent can pick the next backend
# without asking the founder. Every pattern below is a real error string
# this bridge has actually produced, not a guess. Unmatched blocks/failures
# fall through to a generic bucket rather than inventing a false diagnosis.
REASON="success"
if [ "$STATUS" != "success" ]; then
  if echo "$LAST_MESSAGE" | grep -q "^BLOCKED:"; then
    REASON="non_delegable"
  elif echo "$CODEX_LOG" | grep -qi "401 Unauthorized"; then
    REASON="invalid_credential"
  elif echo "$CODEX_LOG" | grep -qi "Key limit exceeded"; then
    REASON="paid_fallback_disabled"
  elif echo "$CODEX_LOG" | grep -qi "usage limit"; then
    REASON="quota_exhausted"
  elif echo "$CODEX_LOG" | grep -qi "Server tool request failed\|model metadata.*not found"; then
    REASON="provider_incompatible"
  elif [ "$WORKER_EXIT" -eq 124 ] || [ "$WORKER_EXIT" -eq 137 ]; then
    REASON="timeout"
  elif [ "$STATUS" = "blocked" ]; then
    REASON="worker_made_no_commit"
  else
    REASON="implementation_failure"
  fi
fi

jq -n \
  --arg status "$STATUS" \
  --arg item "$ITEM" \
  --arg branch "$ACTUAL_BRANCH" \
  --arg worktree "$WORKTREE_DIR" \
  --arg baseSha "$BASE_SHA" \
  --arg resultSha "$RESULT_SHA" \
  --arg diffStat "$DIFF_STAT" \
  --arg verify "$VERIFY_STATUS" \
  --arg lastMessage "$LAST_MESSAGE" \
  --arg stopReason "$STOP_REASON" \
  --arg reason "$REASON" \
  --arg model "$MODEL" \
  --arg provider "$PROVIDER" \
  '{status:$status,reason:$reason,item:$item,branch:$branch,worktree:$worktree,baseSha:$baseSha,resultSha:$resultSha,diffStat:$diffStat,verification:$verify,workerLastMessage:$lastMessage,stopReason:$stopReason,model:$model,provider:$provider}'

case "$STATUS" in
  success) exit 0 ;;
  blocked) exit 2 ;;
  *) exit 1 ;;
esac
