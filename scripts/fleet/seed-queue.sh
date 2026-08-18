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

DRY_RUN="false"
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="true" ;;
  esac
done

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
  # Stage headings marked (parked)/(deleted) — every item beneath one is
  # founder-excluded scope and must never be auto-queued. PHASE.md:4715
  # "### Stage 15 — Lifestyle network and MunroMerchant (parked)" carries
  # "Founder scope override (2026-08-12): ... do not select it for
  # implementation", and the first version of this seeder queued all five
  # Stage 15 items anyway; an agent then actually worked 15.2.
  parked_ranges="$(mktemp)"
  grep -nE '^### Stage [0-9]+ .*\((parked|deleted)\)' "$PHASE" | while IFS= read -r h; do
    hl="${h%%:*}"
    # next stage heading after this one bounds the parked region
    nxt=$(awk -v s="$hl" 'NR>s && /^### Stage /{print NR; exit}' "$PHASE")
    echo "$hl ${nxt:-999999999}"
  done > "$parked_ranges"

  in_parked() { # $1 = line number
    while read -r a b; do
      [ -z "${a:-}" ] && continue
      [ "$1" -gt "$a" ] && [ "$1" -lt "$b" ] && return 0
    done < "$parked_ranges"
    return 1
  }

  # Unchecked top-level items: "- [ ] **N.N Title**"
  grep -nE '^- \[ \] \*\*[0-9]+\.[0-9]+ ' "$PHASE" | while IFS= read -r line; do
    lineno="${line%%:*}"
    raw="${line#*:}"
    # Skip anything under a parked/deleted stage heading.
    in_parked "$lineno" && continue
    num=$(printf '%s' "$raw" | sed -E 's/^- \[ \] \*\*([0-9]+\.[0-9]+).*/\1/')
    title=$(printf '%s' "$raw" | sed -E 's/^- \[ \] \*\*[0-9]+\.[0-9]+ (.*)\*\*.*/\1/' | tr -d '"')
    # A heading that WRAPS puts its closing `**` on the next line, so the
    # substitution above matches nothing and `title` silently keeps the whole
    # raw line — markup and all. Observed live: 4.9 and 4.10 were queued as
    # "PHASE 4.10 — - [ ] **4.10 Virtual Wardrobe Studio — multi-look queue and".
    # Detect that (title still carries the checkbox prefix), then rebuild it by
    # joining the continuation line up to its closing `**`.
    case "$title" in
      "- [ ]"*)
        cont=$(sed -n "$((lineno + 1))p" "$PHASE" | sed -E 's/^[[:space:]]+//; s/\*\*.*//')
        title=$(printf '%s' "$raw" | sed -E 's/^- \[ \] \*\*[0-9]+\.[0-9]+ //')
        title="$title $cont"
        title=$(printf '%s' "$title" | sed -E 's/[[:space:]]+$//' | tr -d '"')
        ;;
    esac
    # Context must stop at the next item or stage heading. A fixed 60-line
    # window bled across boundaries: item 14.9's context reached into Stage
    # 15's "do not select it for implementation" override and wrongly
    # excluded an active item as if it were parked.
    ctx_end=$(awk -v s="$lineno" '
      NR>s && (/^- \[[ x]\] \*\*[0-9]+\.[0-9]+ / || /^### Stage /) {print NR-1; exit}
    ' "$PHASE")
    [ -z "$ctx_end" ] && ctx_end=$((lineno+60))
    [ "$ctx_end" -gt $((lineno+60)) ] && ctx_end=$((lineno+60))
    ctx=$(sed -n "${lineno},${ctx_end}p" "$PHASE")
    tier="implementation"; p=$((pri+50))
    case "$ctx" in
      *implemented_unverified*) p=$((pri)); tier="implementation" ;;
      *verified_local*)         p=$((pri+20)) ;;
    esac
    # Founder-gated or externally blocked items are never auto-queued as
    # claimable work — previously they were merely de-prioritised, which still
    # let an idle agent pick them up once higher-priority work ran out.
    case "$ctx" in
      *"do not select it for implementation"*|*"Founder scope override"*) continue ;;
      *blocked_external*|*founder*decision*|*"founder authorization"*) continue ;;
    esac

    # Titles that DECLARE the item parked/deleted, e.g.
    #   "18.9 Parked — vague corporate analytics"
    #   "16.3 Deleted — generic vertical-pack framework"
    case "$title" in
      Parked\ —*|Deleted\ —*|Parked\ -*|Deleted\ -*) continue ;;
    esac

    # A trailing "(... parked)" is genuinely ambiguous and must NOT be guessed:
    #   16.5 "Moonstruck wedding planner (full vertical pack parked)" -> the
    #        whole item is parked, and it carries no founder-override body
    #        marker, so the checks above miss it entirely.
    #   10.2 "Honeymoon Phase (Seven-Day Wardrobe parked)" -> the item is
    #        ACTIVE; only a named sub-feature is parked.
    # Both look identical to a matcher. Flag for a human instead of excluding
    # active work or queueing parked work — same principle as unscoped paths.
    ambiguous_parked="false"
    case "$title" in
      *parked\)|*Parked\)|*deleted\)|*Deleted\)) ambiguous_parked="true" ;;
    esac

    # Infer REAL owned paths from the item's own text. Handing every task the
    # generic ["packages/**","apps/**"] made every agent "own" everything,
    # so path isolation existed on paper only — and once the queue started
    # enforcing disjointness, it serialised the whole fleet onto one task.
    # Items almost always name their own app, so derive from that and fall
    # back to the broad claim only when nothing is nameable.
    paths=""
    case "$ctx" in *apps/retailer*) paths="$paths\"apps/retailer/**\"," ;; esac
    case "$ctx" in *apps/customer*) paths="$paths\"apps/customer/**\"," ;; esac
    case "$ctx" in *apps/admin*)    paths="$paths\"apps/admin/**\","    ;; esac
    case "$ctx" in *packages/domain*)   paths="$paths\"packages/domain/**\","   ;; esac
    case "$ctx" in *packages/database*) paths="$paths\"packages/database/**\"," ;; esac
    # If no real path could be inferred, do NOT fall back to the broad
    # ["packages/**","apps/**"] claim. That pretends isolation exists while
    # letting the task collide with everything. Emit it flagged so a human
    # (or a frontier agent) scopes it before it can ever be claimed.
    if [ -n "$paths" ]; then
      paths="[${paths%,}]"; scope="false"
    else
      paths='[]'; scope="true"
    fi
    # An ambiguously-parked title is unclaimable until a human resolves it.
    [ "$ambiguous_parked" = "true" ] && scope="true"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$num" "$title" "$tier" "$p" "$paths" "$scope" "$ambiguous_parked"
  done > "$FLEET_DIR/.phase_items.tsv" || true

  while IFS=$'\t' read -r num title tier p paths scope ambig; do
    [ -n "${num:-}" ] || continue
    if [ "${ambig:-false}" = "true" ]; then
      why="NEEDS_SCOPE: title declares parked scope ambiguously — confirm whether the WHOLE item is parked (like 16.5) or only a named sub-feature (like 10.2) before this may be claimed."
    elif [ "${scope:-false}" = "true" ]; then
      why="NEEDS_SCOPE: owned_paths could not be inferred from PHASE.md; scope this before it can be claimed."
    else
      why=""
    fi
    add_task "phase-$num" "PHASE $num — $title" "$tier" "$p" \
      "${paths:-[]}" "pnpm lint && pnpm typecheck" "$why"
    if [ "${scope:-false}" = "true" ]; then
      # $TMP is a bare JSON array (add_task does `. += [...]`), NOT the
      # {tasks:[...]} envelope — addressing .tasks[] here silently matched
      # nothing, so needs_scope was never actually set.
      jq --arg id "phase-$num" '(.[]|select(.id==$id)) |= (.needs_scope=true)' "$TMP" > "$TMP.s" && mv "$TMP.s" "$TMP"
    fi
  done < "$FLEET_DIR/.phase_items.tsv"
  rm -f "$FLEET_DIR/.phase_items.tsv" "$parked_ranges"
fi

# ---------------------------------------------------------------------------
# Defense in depth: never let a candidate task carrying a founder-prohibited
# id prefix reach the queue, whatever generated it. paon-fleet's own
# FLEET_PROHIBITED_PREFIXES (default "drape-") is the permanent claim-time
# gate; this drops the same prefixes here too, at the source, in case a
# future generator (this file doesn't currently emit any, but nothing here
# enforced that) ever does.
PROHIBITED_PREFIXES="${PAON_FLEET_PROHIBITED_PREFIXES:-drape-}"
jq --arg prefixes "$PROHIBITED_PREFIXES" '
  map(select(
    (.id as $tid
     | ($prefixes | split(",") | map(select(. != "")))
     | map(. as $p | $tid | startswith($p)) | any) | not
  ))
' "$TMP" > "$TMP.filtered" && mv "$TMP.filtered" "$TMP"

# ---------------------------------------------------------------------------
# Merge into existing queue, preserving in-flight claims and completed work.
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "true" ]; then
  new_count="$(jq 'length' "$TMP")"
  if [ -f "$QUEUE" ]; then
    added_count="$(jq --slurpfile new "$TMP" '
      (.tasks // []) as $old | ($old | map(.id)) as $ids
      | [$new[0][] | select(.id as $i | $ids | index($i) | not)] | length
    ' "$QUEUE")"
  else
    added_count="$new_count"
  fi
  echo "DRY RUN: would add $added_count new task(s) out of $new_count generated; $QUEUE not modified."
  rm -f "$TMP"
  exit 0
fi

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
