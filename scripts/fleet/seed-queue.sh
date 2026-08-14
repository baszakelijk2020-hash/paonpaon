#!/usr/bin/env bash
# seed-queue.sh — build the fleet work queue from docs/PHASE.md + known blockers.
#
# WHY: agents previously each parsed a 500 KB PHASE.md to decide what to do.
# That is slow, non-deterministic and collides. This extracts the open items
# ONCE into a machine-readable queue that paon-fleet can hand out atomically.
#
# Priority is deliberately NOT PHASE order. The founder's stated goal is a
# hardened, sellable platform for first paying retailers — so consolidation
# and integration debt outrank new capability, and unproven claims outrank
# unstarted work (a feature believed done but unverified is the bigger risk).
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
COMMON_DIR="$(git rev-parse --git-common-dir)"
case "$COMMON_DIR" in /*) ;; *) COMMON_DIR="$(cd "$COMMON_DIR" && pwd)" ;; esac
FLEET_DIR="$COMMON_DIR/paon-fleet"
QUEUE="$FLEET_DIR/queue.json"
PHASE="$REPO_ROOT/docs/PHASE.md"
mkdir -p "$FLEET_DIR"

TMP="$(mktemp)"
echo '[]' > "$TMP"

add_task() { # id title tier priority owned_paths acceptance_cmd note
  jq --arg id "$1" --arg title "$2" --arg tier "$3" --argjson pri "$4" \
     --argjson paths "$5" --arg acc "$6" --arg note "${7:-}" \
     '. += [{
        id:$id, title:$title, tier:$tier, priority:$pri,
        status:"open", claimed_by:null, lease_expires_at:null,
        owned_paths:$paths, acceptance_cmd:$acc,
        note:(if $note=="" then null else $note end)
      }]' "$TMP" > "$TMP.n" && mv "$TMP.n" "$TMP"
}

# ---------------------------------------------------------------------------
# TIER 0 — integration debt discovered during the 2026-08-14 consolidation.
# These outrank everything: they are known, bounded, and block a trustworthy
# main branch.
# ---------------------------------------------------------------------------
add_task "consolidate-stale-lanes" \
  "Reconcile 7 stale lane branches (30-54 conflicts each) into ground-zero: lane-d VWS 4.9/4.10, lane-g employee-portal-linking, lane-f wardrobe-service-request, lane-e core-roadmap, lane-h customer-security-boundary, feature/voice-intelligence, feature/conversation-intelligence" \
  "frontier" 1 '["packages/**","apps/**","docs/PHASE.md"]' \
  "pnpm lint && pnpm typecheck && pnpm test" \
  "5-8 days old, real feature work, heavy conflicts. Merge ONE lane at a time, verify green, commit, then next. Do not batch."

add_task "prune-dead-worktrees" \
  "Prune stale .claude/worktrees/* and merged branches; keep the 5 agent worktrees + integration" \
  "light" 2 '[".claude/worktrees/**"]' \
  "git worktree prune --dry-run" \
  "56 worktrees / 146 branches. Only prune branches with 0 commits ahead of ground-zero."

add_task "phase-md-reconciliation" \
  "Reconcile docs/PHASE.md status against reality on consolidated branch: every [x] with no passing proof, every [ ] that is actually done" \
  "frontier" 3 '["docs/PHASE.md","docs/GROUND_TRUTH.md"]' \
  "test -f docs/GROUND_TRUTH.md" \
  "PHASE.md status drifted per-branch across 5 lanes. This is the highest-value audit artifact."

# ---------------------------------------------------------------------------
# TIER 1 — items PHASE.md itself flags as implemented-but-unverified.
# A capability believed done but unproven is the biggest risk to a paid pilot.
# ---------------------------------------------------------------------------
if [ -f "$PHASE" ]; then
  pri=10
  # Unchecked top-level items: "- [ ] **N.N Title**"
  grep -nE '^- \[ \] \*\*[0-9]+\.[0-9]+ ' "$PHASE" | while IFS= read -r line; do
    lineno="${line%%:*}"
    raw="${line#*:}"
    num=$(printf '%s' "$raw" | sed -E 's/^- \[ \] \*\*([0-9]+\.[0-9]+).*/\1/')
    title=$(printf '%s' "$raw" | sed -E 's/^- \[ \] \*\*[0-9]+\.[0-9]+ (.*)\*\*.*/\1/' | tr -d '"')
    # Unverified/implemented-but-unproven items get boosted.
    ctx=$(sed -n "${lineno},$((lineno+60))p" "$PHASE")
    tier="implementation"; p=$((pri+50))
    case "$ctx" in
      *implemented_unverified*) p=$((pri)); tier="implementation" ;;
      *verified_local*)         p=$((pri+20)) ;;
    esac
    case "$ctx" in *blocked_external*|*founder*decision*) p=$((p+400)) ;; esac
    printf '%s\t%s\t%s\t%s\n' "$num" "$title" "$tier" "$p"
  done > "$FLEET_DIR/.phase_items.tsv" || true

  while IFS=$'\t' read -r num title tier p; do
    [ -n "${num:-}" ] || continue
    add_task "phase-$num" "PHASE $num — $title" "$tier" "$p" \
      '["packages/**","apps/**"]' "pnpm lint && pnpm typecheck" ""
  done < "$FLEET_DIR/.phase_items.tsv"
  rm -f "$FLEET_DIR/.phase_items.tsv"
fi

# ---------------------------------------------------------------------------
# Merge into existing queue, preserving in-flight claims and completed work.
# ---------------------------------------------------------------------------
if [ -f "$QUEUE" ] && [ "$(jq '.tasks|length' "$QUEUE" 2>/dev/null || echo 0)" -gt 0 ]; then
  jq --slurpfile new "$TMP" '
    .tasks as $old
    | ($old | map(.id)) as $ids
    | .tasks = ($old + ($new[0] | map(select(.id as $i | $ids | index($i) | not))))
  ' "$QUEUE" > "$QUEUE.n" && mv "$QUEUE.n" "$QUEUE"
else
  jq -n --slurpfile t "$TMP" '{version:1, tasks:$t[0]}' > "$QUEUE"
fi
rm -f "$TMP"

echo "Queue seeded: $QUEUE"
jq -r '"  total=\(.tasks|length)  open=\([.tasks[]|select(.status=="open")]|length)"' "$QUEUE"
