#!/usr/bin/env bash
# PreToolUse guard for the founder-approved analogue watch face (13 Sep 2026).
#
# Any Edit / Write / MultiEdit that touches analogue-clock.tsx, pearl-light.tsx,
# the locked reference in docs/evidence/locked/watch-face/, or any text naming
# the watch (`paon-analogue`, `AnalogueClock`, `PearlLight`), and any Bash
# command that would rewrite those or wipe uncommitted work, is stopped with
# an explicit confirmation prompt. Nothing is blocked outright: the founder
# can still approve a change, but never without being asked first.

set -uo pipefail

payload="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$payload")"

LOCKED_PATHS='(analogue-clock\.tsx|pearl-light\.tsx|docs/evidence/locked/watch-face/)'
LOCKED_TEXT='(paon-analogue|AnalogueClock|analogue-clock|PearlLight|pearl-light|watch-face-lock)'

# The founder has forbidden any change to the watch (13 Sep 2026: "you are
# forbidden to touch that ... only allowed to read"). So a write is refused
# outright — the agent is told why and the founder is never prompted. Reads
# are always allowed.
ask() {
  local reason="REFUSED — the analogue watch face is locked read-only by the founder (13 Sep 2026). $1 You may read it and copy its surface onto other elements, but you must never change the watch itself. Do not retry, re-route or work around this."
  jq -n --arg r "$reason" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

case "$tool" in
  Edit|Write|MultiEdit|NotebookEdit)
    path="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$payload")"
    text="$(jq -r '[.tool_input.old_string, .tool_input.new_string, .tool_input.content, (.tool_input.edits // [] | .[] | .old_string, .new_string)] | map(select(. != null)) | join("\n")' <<<"$payload")"
    if grep -Eq "$LOCKED_PATHS" <<<"$path"; then
      ask "This edits a locked watch file: ${path##*/}."
    fi
    if grep -Eq "$LOCKED_TEXT" <<<"$text"; then
      ask "This edit touches watch-face code or styles (${path##*/})."
    fi
    ;;
  Bash)
    # Redirects to /dev/null and fd merges (2>&1) write nothing; drop them so
    # a read-only command is never mistaken for a write.
    cmd="$(jq -r '.tool_input.command // ""' <<<"$payload" | sed -E 's/[0-9]*>&[0-9]+//g; s/[0-9]*>+[[:space:]]*\/dev\/null//g')"
    writes='(sed[^|;&]*-i|perl[^|;&]*-i|>|\btee\b|\bmv\b|\brm\b|\bcp\b|\btruncate\b|\bgit[[:space:]]+(checkout|restore|reset|stash|clean|rm|mv|apply)|python|node)'
    if grep -Eq 'watch-face-verify\.py[^|;&]*--write' <<<"$cmd"; then
      ask "This re-baselines the locked watch snapshot."
    fi
    if grep -Eq "$LOCKED_TEXT|$LOCKED_PATHS" <<<"$cmd" && grep -Eq "$writes" <<<"$cmd"; then
      ask "This shell command could rewrite the watch face."
    fi
    # Appending (>>) cannot alter the locked rules; overwriting or editing in
    # place can.
    flat="${cmd//>>/}"
    if grep -Eq 'overview\.css' <<<"$cmd" && grep -Eq '(sed[^|;&]*-i|perl[^|;&]*-i|>|\bmv\b|\brm\b|\bcp\b|\btruncate\b|\bgit[[:space:]]+(checkout|restore|reset|stash))' <<<"$flat"; then
      ask "This shell command rewrites overview.css in place, which holds the watch's locked .paon-analogue rules."
    fi
    # The watch is uncommitted work: anything that discards the working tree
    # would erase it.
    if grep -Eq '\bgit[[:space:]]+(clean|stash|reset[[:space:]]+--hard|checkout[[:space:]]+(--[[:space:]]+)?\.([[:space:]]|$)|restore[[:space:]]+(--[^[:space:]]+[[:space:]]+)*\.([[:space:]]|$))' <<<"$cmd"; then
      ask "This git command discards working-tree changes and would erase the uncommitted watch face."
    fi
    ;;
esac
exit 0
