#!/usr/bin/env bash
# Stop hook: verify the checkout the INVOKING session actually worked in,
# never a fixed path.
#
# The previous version of this script did `cd "$(git rev-parse
# --show-toplevel)"` from whatever directory the hook subprocess happened to
# inherit. In practice that inherited directory is the original project
# checkout the session was launched from — NOT wherever a session's Bash
# tool calls had `cd`'d into (e.g. an isolated `git worktree` under
# /private/tmp/...). The result: a session doing all of its real work in its
# own worktree still had its Stop hook run `pnpm lint` against the ORIGINAL
# checkout, so one session could be blocked by lint/typecheck failures in a
# completely different session's in-progress, unrelated changes (for
# example, another session's unfinished merge) that this session never
# touched and has no authority to fix.
#
# Fix: resolve the target directory from the hook's own JSON stdin payload
# (Claude Code hooks receive a JSON object on stdin that includes a `cwd`
# field — see https://code.claude.com/docs/en/hooks.md) rather than trusting
# the hook subprocess's inherited working directory. This makes the check
# follow the invoking session's actual working directory/worktree, with
# graceful fallbacks if that isn't available.

set -uo pipefail

payload=""
if [ ! -t 0 ]; then
  payload="$(cat 2>/dev/null || true)"
fi

hook_cwd=""
if [ -n "$payload" ] && command -v jq >/dev/null 2>&1; then
  hook_cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty' 2>/dev/null || true)"
fi

# Preference order: the hook payload's own cwd (the invoking session's
# actual directory), then $CLAUDE_PROJECT_DIR (only as a last resort — this
# is the ORIGINAL checkout, and using it as a fallback is exactly the
# behavior we're trying to avoid, so it only applies when we truly have no
# session-specific signal), then this process's own $PWD.
target_dir="${hook_cwd:-${CLAUDE_PROJECT_DIR:-$PWD}}"
if [ ! -d "$target_dir" ]; then
  target_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
fi

repo_root="$(cd "$target_dir" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$repo_root" ]; then
  echo "claude-stop-check: '$target_dir' is not inside a git checkout — nothing to verify, skipping." >&2
  exit 0
fi

cd "$repo_root" || exit 1

# A checkout mid-merge/mid-rebase belongs to whichever session is actively
# resolving it. This hook's job is to catch problems the INVOKING session
# introduced, not to gate on another process's unfinished git operation.
if [ -e "$repo_root/.git/MERGE_HEAD" ] || [ -e "$repo_root/.git/rebase-merge" ] || [ -e "$repo_root/.git/rebase-apply" ]; then
  echo "claude-stop-check: '$repo_root' has an in-progress merge/rebase — skipping checks rather than blocking on another process's unfinished git operation." >&2
  exit 0
fi

echo "Running PAON lint in $repo_root ..."
pnpm lint || exit 2

echo "Running PAON typecheck in $repo_root ..."
pnpm typecheck || exit 3

echo "PAON checks passed ($repo_root)."
exit 0
