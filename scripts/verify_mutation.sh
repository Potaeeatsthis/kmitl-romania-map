#!/usr/bin/env bash
# Measures whether the gates actually catch anything.
#
# Every other verify_*.sh asserts something about the code. This one asserts something
# about the other scripts: that when a realistic bug is introduced, at least one of them
# goes red. A check nobody has ever seen fail is a check nobody knows works -- which is
# exactly how the PostToolUse hook died silently for weeks (docs/runbook.md section 2).
#
# Each mutation carries an expectation. A mutation marked `caught` that is missed fails
# this script: a gate has stopped working, or was never wired up. A mutation marked
# `missed` that is now caught is reported as an improvement, not a failure -- someone
# closed a known gap and should update the expectation here.
#
# One `missed` entry remains a documented blind spot, not a bug to fix by accident:
#   M9  reference/romania_search.rs is compiled by nothing since the crate landed.
#       Closing it is a decision, not a patch: either wire the file back into
#       verify_parity.sh as a fourth implementation, or delete it.
#
# M3 and M8 were blind spots until the tie-break pin and the test inventory landed in
# verify_invariants.sh. Neither is detectable by behaviour -- the first produces identical
# output, the second removes the thing that would have complained -- so both are policed
# by reading the source instead.
#
# Runs against HEAD in a throwaway worktree, so uncommitted work in your tree is NOT
# what gets measured, and nothing here can touch your checkout. Takes ~10 minutes,
# which is why it is a weekly scheduled job rather than part of `npm run verify`.
#
# Run via: npm run verify:mutation          all nine
#          bash scripts/verify_mutation.sh M3   just one, while iterating
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ONLY="${1:-}"

LAB="$(mktemp -d)"
CARGO_LAB="$(mktemp -d)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$LAB/tree" >/dev/null 2>&1
  rm -rf "$LAB" "$CARGO_LAB"
}
trap cleanup EXIT

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
note() { printf '  \033[33mnote\033[0m %s\n' "$1"; }

git worktree add --detach "$LAB/tree" HEAD >/dev/null 2>&1 || {
  echo "could not create a worktree -- is this a git repository with a commit?" >&2
  exit 1
}
cd "$LAB/tree"

fail=0
improved=0
reset_tree() { git checkout -- . >/dev/null 2>&1; git clean -fdq >/dev/null 2>&1; }

# Runs one gate, printing which. Returns 0 if the gate CAUGHT the fault.
gate() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf '%s=missed ' "$label"; return 1
  else
    printf '%s=CAUGHT ' "$label"; return 0
  fi
}

INV_S=(bash scripts/verify_invariants.sh --structural)
INV=(bash scripts/verify_invariants.sh)
PAR=(bash scripts/verify_parity.sh)
GOLD=(bash scripts/verify_golden.sh)
CORR=(python3 scripts/verify_correctness.py)
TEST=(cargo test --quiet --manifest-path wasm/Cargo.toml --target-dir "$CARGO_LAB")

# mutate <id> <expectation> <description>; body follows, then `verdict`
CAUGHT_ANY=0
begin() {
  ID="$1"; EXPECT="$2"; DESC="$3"; CAUGHT_ANY=0
  reset_tree
  printf '%-4s %s\n       ' "$ID" "$DESC"
}
check() { gate "$@" && CAUGHT_ANY=1; }
verdict() {
  echo
  if [ "$CAUGHT_ANY" -eq 1 ] && [ "$EXPECT" = "caught" ]; then
    pass "$ID caught, as expected"
  elif [ "$CAUGHT_ANY" -eq 0 ] && [ "$EXPECT" = "missed" ]; then
    note "$ID missed -- documented blind spot"
  elif [ "$CAUGHT_ANY" -eq 1 ] && [ "$EXPECT" = "missed" ]; then
    pass "$ID is now caught -- a gap was closed; change its expectation to 'caught'"
    improved=$((improved + 1))
  else
    bad "$ID went undetected but should be caught -- a gate has stopped working"
    fail=1
  fi
  echo
}
skip() { [ -n "$ONLY" ] && [ "$ONLY" != "$1" ]; }

echo "Fault injection against HEAD"
echo

# --------------------------------------------------------------- I1: one search()
if ! skip M1; then
  begin M1 caught "split search() into a second file (I1)"
  mkdir -p wasm/src/search && echo 'pub fn search() {}' > wasm/src/search/ucs.rs
  check invariants "${INV_S[@]}"
  verdict
fi

# --------------------------------------------------------------- I4: wasm-safe engine
if ! skip M2; then
  begin M2 caught "leak std::time::Instant into the engine (I4)"
  printf 'use std::time::Instant;\n%s' "$(cat wasm/src/metrics.rs)" > wasm/src/metrics.rs
  check invariants "${INV_S[@]}"
  verdict
fi

# --------------------------------------------------------------- the tie-break
if ! skip M3; then
  begin M3 caught "swap the queue tie-break from (f,g,city) to (f,city,g)"
  python3 - <<'PY'
p = 'wasm/src/search.rs'
s = open(p).read()
old = """            .then_with(|| other.g.cmp(&self.g))
            .then_with(|| other.city.cmp(&self.city))"""
new = """            .then_with(|| other.city.cmp(&self.city))
            .then_with(|| other.g.cmp(&self.g))"""
assert s.count(old) == 1, 'tie-break anchor moved -- update verify_mutation.sh'
open(p, 'w').write(s.replace(old, new))
PY
  check invariants "${INV_S[@]}"; check tests "${TEST[@]}"
  check parity "${PAR[@]}"; check golden "${GOLD[@]}"; check correctness "${CORR[@]}"
  verdict
fi

# --------------------------------------------------------------- I2: one language drifts
if ! skip M4; then
  begin M4 caught "change one road weight in C++ only"
  sed -i.bak 's/{0, 1, 75}/{0, 1, 76}/' reference/romania_search.cpp && rm -f reference/*.bak
  check parity "${PAR[@]}"
  verdict
fi

# --------------------------------------------------------------- all three at once
if ! skip M5; then
  begin M5 caught "change the same road weight in all three implementations"
  sed -i.bak 's/{0, 1, 75}/{0, 1, 76}/' reference/romania_search.cpp
  sed -i.bak 's/("Arad", "Zerind", 75)/("Arad", "Zerind", 76)/' reference/romania_search.py
  sed -i.bak 's/(0, 1, 75)/(0, 1, 76)/' wasm/src/graph.rs
  rm -f reference/*.bak wasm/src/*.bak
  check parity "${PAR[@]}"; check golden "${GOLD[@]}"
  verdict
fi

# --------------------------------------------------------------- I3: admissibility
if ! skip M6; then
  begin M6 caught "inflate the heuristic so it stops being admissible"
  python3 - <<'PY'
p = 'reference/romania_search.py'
s = open(p).read()
old = 'heuristic[city] = max(0.0, augmented[reduced_index][reduced_size + reduced_index])'
assert s.count(old) == 1, 'heuristic anchor moved -- update verify_mutation.sh'
open(p, 'w').write(s.replace(old, old + ' * 1.5'))
PY
  check correctness "${CORR[@]}"
  verdict
fi

# --------------------------------------------------------------- the committed table
if ! skip M7; then
  begin M7 caught "corrupt one value in the committed heuristic table"
  python3 - <<'PY'
import re
p = 'wasm/data/heuristics.json'
s = open(p).read()
m = re.search(r'(\d+\.\d{4,})', s)
assert m, 'no float found in heuristics.json'
open(p, 'w').write(s[:m.start()] + str(float(m.group(1)) * 3.0) + s[m.end():])
PY
  check tests "${TEST[@]}"
  verdict
fi

# --------------------------------------------------------------- deleting coverage
if ! skip M8; then
  begin M8 caught "delete a test outright"
  python3 - <<'PY'
p = 'wasm/tests/ucs_tests.rs'
s = open(p).read()
marker = '#[test]\nfn trace_records_one_complete_frame_per_expansion'
i = s.index(marker)
j = s.index('#[test]', i + len(marker))
open(p, 'w').write(s[:i] + s[j:])
PY
  check tests "${TEST[@]}"; check invariants "${INV_S[@]}"
  verdict
fi

# --------------------------------------------------------------- the unbuilt reference
if ! skip M9; then
  begin M9 missed "change a road weight in reference/romania_search.rs only"
  sed -i.bak 's/(0, 1, 75)/(0, 1, 76)/' reference/romania_search.rs && rm -f reference/*.bak
  check invariants "${INV[@]}"; check parity "${PAR[@]}"; check golden "${GOLD[@]}"
  verdict
fi

# --------------------------------------------------------------- the trace contents
if ! skip M10; then
  begin M10 caught "reverse the frontier ordering inside make_step()"
  python3 - <<'PY'
p = 'wasm/src/search.rs'
s = open(p).read()
old = """    visible_frontier.sort_by(|left, right| {
        left.f
            .total_cmp(&right.f)"""
new = """    visible_frontier.sort_by(|left, right| {
        right.f
            .total_cmp(&left.f)"""
assert s.count(old) == 1, 'make_step sort anchor moved -- update verify_mutation.sh'
open(p, 'w').write(s.replace(old, new))
PY
  check tests "${TEST[@]}"; check golden "${GOLD[@]}"; check parity "${PAR[@]}"
  verdict
fi

reset_tree
if [ "$improved" -gt 0 ]; then
  echo "$improved documented gap(s) are now covered -- update their expectations in this file."
  echo
fi
[ "$fail" -eq 0 ] && echo "mutation: PASS" || echo "mutation: FAIL"
exit "$fail"
