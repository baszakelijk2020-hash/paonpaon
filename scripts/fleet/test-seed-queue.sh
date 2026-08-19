#!/usr/bin/env bash
# test-seed-queue.sh — prove the seeder's founder-scope guards actually hold.
#
# WHY THIS EXISTS
# The seeder's scope guards are the only thing between a re-seed and an agent
# being handed founder-prohibited or founder-parked work. That has already gone
# wrong once: an early seeder queued all five Stage 15 items despite the stage
# heading carrying "do not select it for implementation", and an agent then
# actually worked 15.2. The guards were added afterwards but never proven, so
# every later lane re-derived their correctness by hand and wrote "excluded
# pending seeder fix" into its block reason for a fix that had already landed.
#
# This test makes the guards executable truth instead of folklore.
#
# Run: scripts/fleet/test-seed-queue.sh
# Exits non-zero on the first failed assertion. Touches no shared state: every
# run seeds into a throwaway PAON_FLEET_DIR against a fixture PHASE.md.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SEEDER="$REPO_ROOT/scripts/fleet/seed-queue.sh"
SANDBOX="$(mktemp -d)"
trap 'rm -rf "$SANDBOX"' EXIT

pass=0 fail=0
ok()   { printf '  ok   %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  FAIL %s\n' "$1"; fail=$((fail+1)); }

# assert_absent <file> <id> — id must not appear at all
assert_absent() {
  if jq -e --arg i "$2" 'any(.[]; .id==$i)' "$1" >/dev/null 2>&1; then
    bad "$2 must not be queued ($3)"
  else
    ok "$2 excluded ($3)"
  fi
}

# assert_flagged <file> <id> — the item IS emitted and IS marked needs_scope.
# paon-fleet's cmd_take filters `select(.needs_scope != true)`, so needs_scope
# is what makes an emitted task unreachable by an agent.
#
# This deliberately does NOT also accept "absent", even though an absent item is
# equally unclaimable. Accepting both would let a regression that drops the item
# via some unrelated guard still report ok, hiding which mechanism actually
# fired. If one of these items later becomes legitimately excluded outright,
# that is a real behaviour change and should surface as a failure to be read.
assert_flagged() {
  if ! jq -e --arg i "$2" 'any(.[]; .id==$i)' "$1" >/dev/null 2>&1; then
    bad "$2 vanished entirely — expected it emitted-and-flagged ($3)"
  elif jq -e --arg i "$2" 'any(.[]; .id==$i and .needs_scope==true)' "$1" >/dev/null 2>&1; then
    ok "$2 emitted but flagged needs_scope ($3)"
  else
    bad "$2 is claimable but should not be ($3)"
  fi
}

# assert_absent proves nothing about a guard if the item was never a candidate
# in the first place: the seeder only ever scans unchecked "- [ ] **N.N " items,
# so a completed "- [x]" item is absent no matter what the guards do. Two IDs in
# the parked list below (13.1, 13.2) were exactly that — vacuously passing while
# appearing to prove the parked-stage guard. Gate the real-PHASE.md assertions on
# the item actually being an unchecked candidate.
is_unchecked_candidate() { # $1 = "phase-N.N"
  grep -qE "^- \[ \] \*\*${1#phase-} " "$2"
}

assert_absent_real() { # <file> <id> <phase.md> <why>
  if ! is_unchecked_candidate "$2" "$3"; then
    printf '  SKIP %s — not an unchecked item in PHASE.md; absence proves no guard\n' "$2"
    skip=$((skip+1)); return 0
  fi
  assert_absent "$1" "$2" "$4"
}

# assert_present <file> <id> — active work must still be queued. Guards that
# over-exclude are as harmful as guards that under-exclude: item 14.9 was once
# wrongly dropped because a fixed context window bled into Stage 15's override.
assert_present() {
  if jq -e --arg i "$2" 'any(.[]; .id==$i)' "$1" >/dev/null 2>&1; then
    ok "$2 still queued ($3)"
  else
    bad "$2 wrongly excluded — active work must not be dropped ($3)"
  fi
}

# ---------------------------------------------------------------------------
# 1. Fixture test — guard semantics, independent of PHASE.md's current content.
# ---------------------------------------------------------------------------
FIXTURE="$SANDBOX/PHASE.fixture.md"
cat > "$FIXTURE" <<'EOF'
### Stage 90 — Active stage

- [ ] **90.1 Ordinary active item in apps/retailer**
  Status: implemented_unverified. Touches apps/retailer and packages/domain.

- [ ] **90.2 Honeymoon Phase (Seven-Day Wardrobe parked)**
  Status: verified_local. Item is ACTIVE in apps/customer; only the named
  sub-feature is parked. Must not be silently excluded.

- [ ] **90.3 Item gated on a founder decision**
  Status: blocked_external — needs a founder decision before implementation.
  Touches apps/retailer.

- [ ] **90.4 Parked — vague thing nobody scoped**
  Title itself declares the item parked. Touches apps/retailer.

- [ ] **90.5 Deleted — superseded framework**
  Title itself declares the item deleted. Touches apps/customer.

### Stage 91 — Historical design (parked)

> **Founder scope override (2026-08-12):** preserve this historical design but
> do not select it for implementation.

- [ ] **91.1 Something beneath a parked stage heading**
  Touches apps/retailer and packages/database.

- [ ] **91.2 Another thing beneath the same parked heading**
  Touches apps/customer.

### Stage 92 — Active again

- [ ] **92.1 Active item after the parked stage ends**
  Status: implemented_unverified. Touches apps/admin.
EOF

OUT="$SANDBOX/fixture.json"
PAON_FLEET_DIR="$SANDBOX/fleet-fixture" PAON_FLEET_PHASE="$FIXTURE" \
  "$SEEDER" --dry-run > "$OUT"

echo "fixture guards:"
assert_present    "$OUT" phase-90.1 "plain active item"
assert_present    "$OUT" phase-92.1 "active item after a parked stage closes"
assert_absent     "$OUT" phase-90.3 "blocked_external / founder decision in body"
assert_absent     "$OUT" phase-90.4 "title declares 'Parked —'"
assert_absent     "$OUT" phase-90.5 "title declares 'Deleted —'"
assert_absent     "$OUT" phase-91.1 "beneath '(parked)' stage heading"
assert_absent     "$OUT" phase-91.2 "beneath '(parked)' stage heading"
assert_flagged "$OUT" phase-90.2 "ambiguous trailing '(... parked)' title"

# ---------------------------------------------------------------------------
# 2. Dry run must not mutate shared state.
# ---------------------------------------------------------------------------
echo "dry-run isolation:"
if [ -f "$SANDBOX/fleet-fixture/queue.json" ]; then
  bad "--dry-run wrote a queue.json"
else
  ok "--dry-run wrote no queue.json"
fi

# ---------------------------------------------------------------------------
# 3. Regression test against the real docs/PHASE.md.
#
# These IDs are parked/deleted by explicit marker text in PHASE.md itself, so a
# failure here means either a guard regressed or the founder genuinely unparked
# the item. If the latter, delete the ID from this list in the same commit that
# records the founder's decision — do not weaken the guard.
# ---------------------------------------------------------------------------
REAL="$SANDBOX/real.json"
PAON_FLEET_DIR="$SANDBOX/fleet-real" "$SEEDER" --dry-run > "$REAL"

echo "real PHASE.md — founder-parked scope:"
for id in phase-13.1 phase-13.2 phase-13.3 \
          phase-15.1 phase-15.2 phase-15.3 phase-15.4 phase-15.5 \
          phase-16.3 phase-18.9 phase-18.10; do
  assert_absent "$REAL" "$id" "founder-parked/deleted in PHASE.md"
done

echo "real PHASE.md — ambiguous scope stays unclaimable:"
assert_flagged "$REAL" phase-16.5 "'(full vertical pack parked)' title"

echo
printf 'seed-queue guards: %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
