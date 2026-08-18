#!/usr/bin/env bash
# test-fleet.sh — safety invariants for the fleet coordinator.
#
# Every case here corresponds to a defect that was real, not hypothetical:
# a direct `claim` bypassed all the guards `take` enforced; any agent could
# mark another agent's task done; `done` could be applied twice; founder-parked
# Stage 15 items were auto-queued and one was actually worked; an exclusive
# whole-repo merge was offered while three agents were mid-edit in those paths;
# and an empty result left agents inventing their own work.
#
# Runs against a throwaway queue in its own git repo, so it can never touch
# real fleet state.
set -uo pipefail

FLEET_SRC="$(cd "$(dirname "$0")" && pwd)/paon-fleet"
SEED_SRC="$(cd "$(dirname "$0")" && pwd)/seed-queue.sh"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"; }

SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT
cd "$SANDBOX"
git init -q . && git commit -q --allow-empty -m init
mkdir -p scripts/fleet && cp "$FLEET_SRC" scripts/fleet/paon-fleet && chmod +x scripts/fleet/paon-fleet
FLEET="$SANDBOX/scripts/fleet/paon-fleet"
Q="$SANDBOX/.git/paon-fleet/queue.json"
mkdir -p "$(dirname "$Q")"

seed() { cat > "$Q"; }

run() { # AGENT_ID TIERS args...
  local a="$1" t="$2"; shift 2
  PAON_AGENT_ID="$a" PAON_AGENT_TIERS="$t" "$FLEET" "$@" 2>&1
}

echo "=== fleet safety invariants ==="

# ---------------------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"t1","title":"t1","tier":"implementation","priority":1,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/a/**"],"acceptance_cmd":"true"}
]}
JSON
run agentA implementation take >/dev/null
out="$(run agentB implementation claim t1)"
case "$out" in
  *CLAIM_REFUSED*) ok "duplicate claim rejected (a claimed task cannot be re-claimed)" ;;
  *) bad "duplicate claim rejected" "CLAIM_REFUSED" "$out" ;;
esac

# wrong-agent mutations -------------------------------------------------------
for verb in done block release heartbeat; do
  out="$(run agentB implementation "$verb" t1 "x")"
  case "$out" in
    *REJECTED*) ok "wrong-agent '$verb' rejected" ;;
    *) bad "wrong-agent '$verb' rejected" "REJECTED" "$out" ;;
  esac
done

# owner can still act, and double-done is refused ------------------------------
out="$(run agentA implementation done t1)"
case "$out" in *"OK: t1 -> done"*) ok "owner may complete its own task" ;;
  *) bad "owner may complete its own task" "OK" "$out" ;; esac
out="$(run agentA implementation done t1)"
case "$out" in *"already done"*) ok "double-done rejected" ;;
  *) bad "double-done rejected" "already done" "$out" ;; esac

# ---------------------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"held","title":"held","tier":"implementation","priority":1,"status":"claimed",
  "claimed_by":"other","lease_expires_at":"2099-01-01T00:00:00Z","owned_paths":["apps/shared/**"]},
 {"id":"overlap","title":"overlap","tier":"implementation","priority":2,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/shared/sub/**"]},
 {"id":"safe","title":"safe","tier":"implementation","priority":3,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/other/**"]}
]}
JSON
got="$(run agentC implementation take | jq -r '.id' 2>/dev/null)"
[ "$got" = "safe" ] && ok "overlapping-path task skipped, disjoint one taken" \
  || bad "overlapping-path task skipped" "safe" "$got"
out="$(run agentD implementation claim overlap)"
case "$out" in *PATH_CONFLICT*) ok "direct claim of overlapping path refused" ;;
  *) bad "direct claim of overlapping path refused" "PATH_CONFLICT" "$out" ;; esac

# ---------------------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"busy","title":"busy","tier":"implementation","priority":5,"status":"claimed",
  "claimed_by":"other","lease_expires_at":"2099-01-01T00:00:00Z","owned_paths":["apps/x/**"]},
 {"id":"excl","title":"excl","tier":"frontier","priority":1,"status":"open","exclusive":true,
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["packages/**","apps/**"]}
]}
JSON
out="$(run agentE frontier take)"
[ "$out" = "NO_ELIGIBLE_WORK" ] && ok "exclusive task withheld while fleet is busy" \
  || bad "exclusive task withheld while busy" "NO_ELIGIBLE_WORK" "$out"
out="$(run agentE frontier claim excl)"
case "$out" in *FLEET_NOT_QUIET*) ok "direct claim of exclusive task refused while busy" ;;
  *) bad "direct claim of exclusive refused while busy" "FLEET_NOT_QUIET" "$out" ;; esac

# ---------------------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"scoped","title":"unscoped","tier":"implementation","priority":1,"status":"open",
  "needs_scope":true,"claimed_by":null,"lease_expires_at":null,"owned_paths":[]}
]}
JSON
out="$(run agentF implementation take)"
[ "$out" = "NO_ELIGIBLE_WORK" ] && ok "unscoped task never auto-assigned" \
  || bad "unscoped task never auto-assigned" "NO_ELIGIBLE_WORK" "$out"

# release must not livelock ---------------------------------------------------
# Observed live: refusing a task on policy grounds returned it to "open" and
# the stop hook handed the identical task straight back, forever.
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"unwanted","title":"unwanted","tier":"implementation","priority":1,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/u/**"]},
 {"id":"wanted","title":"wanted","tier":"implementation","priority":2,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/w/**"]}
]}
JSON
run agentR implementation take >/dev/null            # gets "unwanted" (priority 1)
run agentR implementation release unwanted "policy refusal" >/dev/null
again="$(run agentR implementation take | jq -r '.id' 2>/dev/null)"
[ "$again" = "wanted" ] && ok "released task not re-served to the agent that refused it" \
  || bad "no livelock after release" "wanted" "$again"
# but another agent may still take it — refusal is per-agent, not a global block
other="$(run agentS implementation claim unwanted | jq -r '.id' 2>/dev/null)"
[ "$other" = "unwanted" ] && ok "a different agent may still claim a released task" \
  || bad "different agent may claim released task" "unwanted" "$other"

# freeze ----------------------------------------------------------------------
# Without this, an explicit founder freeze could only be honoured by every
# agent refusing every task by hand.
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"work","title":"work","tier":"implementation","priority":1,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/z/**"]}
]}
JSON
run agentZ implementation freeze "control-plane repair" >/dev/null
out="$(run agentZ implementation take)"
[ "$out" = "NO_ELIGIBLE_WORK" ] && ok "frozen fleet assigns nothing via take" \
  || bad "frozen fleet assigns nothing" "NO_ELIGIBLE_WORK" "$out"
out="$(run agentZ implementation claim work)"
case "$out" in *FLEET_FROZEN*) ok "frozen fleet refuses direct claim too" ;;
  *) bad "frozen fleet refuses direct claim" "FLEET_FROZEN" "$out" ;; esac
run agentZ implementation unfreeze >/dev/null
got="$(run agentZ implementation take | jq -r '.id' 2>/dev/null)"
[ "$got" = "work" ] && ok "unfreeze restores assignment" \
  || bad "unfreeze restores assignment" "work" "$got"

# empty queue -----------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[]}
JSON
out="$(run agentG implementation take)"
[ "$out" = "NO_ELIGIBLE_WORK" ] && ok "empty queue returns NO_ELIGIBLE_WORK (clean stop)" \
  || bad "empty queue returns NO_ELIGIBLE_WORK" "NO_ELIGIBLE_WORK" "$out"

# tier routing ----------------------------------------------------------------
seed <<'JSON'
{"version":1,"tasks":[
 {"id":"front","title":"front","tier":"frontier","priority":1,"status":"open",
  "claimed_by":null,"lease_expires_at":null,"owned_paths":["apps/f/**"]}
]}
JSON
out="$(run agentH light take)"
[ "$out" = "NO_ELIGIBLE_WORK" ] && ok "light agent refused frontier-tier task" \
  || bad "light agent refused frontier task" "NO_ELIGIBLE_WORK" "$out"

# parked-item exclusion (seeder) ----------------------------------------------
mkdir -p "$SANDBOX/docs"
cat > "$SANDBOX/docs/PHASE.md" <<'MD'
### Stage 14 — Active work
- [ ] **14.9 Real item in apps/retailer**
  - touches apps/retailer/** and packages/domain/**
### Stage 15 — Lifestyle network (parked)
> **Founder scope override (2026-08-12):** preserve this historical design but
> do not select it for implementation.
- [ ] **15.1 Parked item**
  - should never be queued
- [ ] **15.2 Also parked**
  - should never be queued
### Stage 16 — Active again
- [ ] **16.9 Another real item**
  - touches apps/customer/**
- [ ] **16.3 Deleted — generic vertical-pack framework**
  - touches apps/retailer/**
- [ ] **16.5 Moonstruck wedding planner (full vertical pack parked)**
  - touches apps/retailer/**
- [ ] **18.9 Parked — vague corporate analytics**
  - touches apps/retailer/**
- [ ] **10.2 Honeymoon Phase (Seven-Day Wardrobe parked)**
  - touches apps/customer/**
- [ ] **19.1 Close parked/deleted route-gating gap**
  - touches apps/retailer/**
MD
cp "$SEED_SRC" scripts/fleet/seed-queue.sh && chmod +x scripts/fleet/seed-queue.sh
rm -f "$Q"
( cd "$SANDBOX" && ./scripts/fleet/seed-queue.sh >/dev/null 2>&1 )
parked="$(jq -r '[.tasks[]|select(.id|startswith("phase-15"))]|length' "$Q" 2>/dev/null)"
active="$(jq -r '[.tasks[]|select(.id=="phase-14.9" or .id=="phase-16.9")]|length' "$Q" 2>/dev/null)"
[ "${parked:-x}" = "0" ] && ok "founder-parked stage items never queued" \
  || bad "founder-parked items never queued" "0" "${parked:-<none>}"
[ "${active:-0}" = "2" ] && ok "active stage items still queued around a parked stage" \
  || bad "active items still queued" "2" "${active:-<none>}"

# 'Parked —' / 'Deleted —' title prefixes are unambiguous: never queued.
for id in phase-16.3 phase-18.9; do
  n="$(jq -r --arg i "$id" '[.tasks[]|select(.id==$i)]|length' "$Q")"
  [ "$n" = "0" ] && ok "title-declared parked/deleted item excluded ($id)" \
    || bad "title-declared parked excluded ($id)" "0" "$n"
done

# Ambiguous trailing "(... parked)" must be flagged unclaimable, not guessed.
for id in phase-16.5 phase-10.2; do
  ns="$(jq -r --arg i "$id" '.tasks[]|select(.id==$i)|.needs_scope // false' "$Q")"
  [ "$ns" = "true" ] && ok "ambiguous '(... parked)' flagged needs_scope ($id)" \
    || bad "ambiguous parked flagged ($id)" "true" "$ns"
done
out="$(run agentP implementation take)"
case "$out" in
  *'"id": "phase-16.5"'*|*'"id": "phase-10.2"'*)
    bad "ambiguous parked never auto-assigned" "not phase-16.5/10.2" "$out" ;;
  *) ok "ambiguous parked item never auto-assigned" ;;
esac

# 19.1 merely MENTIONS parked routes — it is active cleanup and must survive.
n="$(jq -r '[.tasks[]|select(.id=="phase-19.1")|select(.needs_scope != true)]|length' "$Q")"
[ "$n" = "1" ] && ok "item that only mentions 'parked' stays claimable (19.1)" \
  || bad "19.1 stays claimable" "1" "$n"

echo
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ]
