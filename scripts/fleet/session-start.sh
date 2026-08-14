#!/usr/bin/env bash
# session-start.sh — SessionStart hook: every new/resumed agent session is
# immediately told how to get work, instead of waking at an idle prompt.
#
# WHY: the previous setup had NO SessionStart hook, and the VS Code launcher
# passed no prompt, so a freshly started agent simply sat there. Combined with
# a Stop hook that allowed stopping, agents idled at both ends of their life.
#
# Emits additionalContext, which Claude Code injects into the session.
set -uo pipefail

# Claude-only hook; see stop-continue.sh. No-op in Codex/OpenRouter lanes.
[ -n "${PAON_NON_CLAUDE_AGENT:-}" ] && exit 0

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
FLEET="$REPO_ROOT/scripts/fleet/paon-fleet"
AGENT_ID="${PAON_AGENT_ID:-$(basename "$REPO_ROOT")}"
[ -x "$FLEET" ] || exit 0

# Recover anything a crashed predecessor left leased.
"$FLEET" reap >/dev/null 2>&1 || true

mine="$("$FLEET" status 2>/dev/null | grep "\[$AGENT_ID\]" || true)"
open_n="$("$FLEET" status 2>/dev/null | awk '/^open:/{print $2}')"

if [ -n "$mine" ]; then
  msg="You are PAON fleet agent '$AGENT_ID'. You already hold a leased task:

$mine

Resume it. Run 'scripts/fleet/paon-fleet heartbeat <ID>' to hold the lease.
When it is genuinely green and committed: 'scripts/fleet/paon-fleet done <ID>',
then immediately 'scripts/fleet/paon-fleet take' for the next one."
else
  msg="You are PAON fleet agent '$AGENT_ID'. You hold no task. There are ${open_n:-?} open.

Get work ONLY from the shared atomic queue — never by reading docs/PHASE.md
yourself:

    scripts/fleet/paon-fleet take

Then: edit only inside OWNED_PATHS, delegate recon/tests to cheap Haiku
subagents, run the ACCEPTANCE command and genuinely see it pass, commit,
'paon-fleet done <ID>', and immediately take the next task. Never idle.

CURRENT DIRECTIVE: do not add new features. Harden, wire, verify and prove
what already exists so the platform is sellable to a paying retailer."
fi

jq -nc --arg c "$msg" '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$c}}'
