#!/usr/bin/env bash
# Structural invariants I1 and I4, plus clean builds of all three implementations.
# Run via: npm run verify:invariants
set -uo pipefail

cd "$(dirname "$0")/.."
. scripts/lib/rust_build.sh
BIN="$(mktemp -d)"
trap 'rm -rf "$BIN"' EXIT
fail=0

# --structural runs only the grep-based checks, skipping compilation. Used by the
# PostToolUse hook so editing a file gives feedback immediately rather than after a build.
STRUCTURAL_ONLY=0
[ "${1:-}" = "--structural" ] && STRUCTURAL_ONLY=1

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }
warn() { printf '  \033[33mwarn\033[0m %s\n' "$1"; }

echo "I1 — one search function"
# UCS and A* must remain the same function, differing only by the heuristic passed in.
# Two implementations would drift and silently invalidate every reported number.
count=$(grep -cE '^(pub )?fn search\(' wasm/src/search.rs || true)
where="wasm/src/search.rs"
if [ "$count" -eq 1 ]; then
  pass "$where defines exactly one search()"
else
  bad "$where defines $count search() functions, expected 1"
fi

# The concrete failure mode: the empty placeholders invite splitting one function into
# two files, which is how the two implementations start drifting apart.
split=""
for f in wasm/src/search/ucs.rs wasm/src/search/astar.rs wasm/src/search/mod.rs; do
  [ -s "$f" ] && split="$split $f"
done
if [ -z "$split" ]; then
  pass "no split ucs.rs/astar.rs implementation"
else
  bad "UCS and A* must stay one function; found:$split"
fi

echo
echo "I4 — engine stays wasm-safe"
# std::io, std::time and println! belong to the CLI. Instant panics on wasm32,
# so a leak into the engine breaks the browser build at runtime, not compile time.
BANNED='println!|eprintln!|Instant|black_box|io::'
# Every Rust source file except the native CLI binaries is engine code.
hits=$(find wasm/src -type f -name '*.rs' ! -path '*/bin/*' -exec \
       grep -nHE "$BANNED" {} + 2>/dev/null || true)
scope="wasm/src excluding wasm/src/bin"
if [ -z "$hits" ]; then
  pass "no banned symbols in $scope"
else
  bad "banned symbols found in $scope:"
  echo "$hits" | sed 's/^/       /'
fi

echo
echo "Test inventory"
# Deleting a test makes the suite *greener*, so nothing else in this harness notices.
# Measured: removing trace_records_one_complete_frame_per_expansion left cargo test and
# every verify script passing (scripts/verify_mutation.sh, M8).
#
# Renaming a test on purpose means editing this list too -- which is the point. The edit
# shows up in the diff, where a reviewer can see coverage being moved rather than lost.
REQUIRED_TESTS="
ucs_finds_the_known_optimal_route
ucs_matches_an_independent_solver_for_every_city_pair
trace_records_one_complete_frame_per_expansion
invalid_inputs_return_errors_instead_of_panicking
current_flow_astar_finds_the_known_optimal_route
current_flow_astar_is_optimal_for_every_city_pair
current_flow_table_is_admissible_and_zero_at_every_goal
current_flow_table_is_consistent_on_every_road
embedded_table_matches_runtime_heuristic
embedded_table_rejects_an_invalid_goal
ucs_trace_matches_the_committed_golden
astar_trace_matches_the_committed_golden
"
missing=""
for name in $REQUIRED_TESTS; do
  grep -rqE "^fn $name\\(" wasm/tests/*.rs 2>/dev/null || missing="$missing $name"
done
if [ -z "$missing" ]; then
  count=$(echo $REQUIRED_TESTS | wc -w | tr -d ' ')
  pass "all $count required tests are present"
else
  bad "tests missing -- deleted, or renamed without updating this list:"
  for name in $missing; do echo "         $name"; done
fi

echo
echo "Frontend test inventory"
# The same argument as above, for the 25 vitest cases. Deleting one makes `npm test`
# greener, and until scripts/verify_mutation.sh grew a vitest gate (M13-M15) nothing
# in this harness could see the frontend suite at all.
#
# Listed in full rather than curated: JS tests are named by string, so the list costs
# nothing to maintain and a rename shows up in the diff, which is the point.
FRONTEND_TESTS_FILE="$BIN/frontend-tests"
cat > "$FRONTEND_TESTS_FILE" <<'TESTS'
accepts the Rust-generated sample
announces an empty search outside the listbox
clamps an out-of-bounds step to the last frame
clamps frames and toggles playback safely
closes with Escape and returns focus to the results button
does not capture the pointer until the drag threshold is crossed
does not select a city when the pointer drags across the map
expanded cities include cities through the current step
filters city options by the beginning of the name
keeps the closed drawer out of keyboard navigation
keeps the expansion ring populated after a start city is chosen on the map
leaves the map viewport untouched when a zoomed-in click triggers a rolling restart
rejects malformed discovered nodes
rejects malformed frontier nodes
reports invalid JSON clearly
reset returns to a blank state without touching speed
resets to blank and snaps the map back to its default viewport
returns 0 when data is null
returns only the cities in the current frontier
rolling-restarts even when the clicked city is already a current endpoint
rolling-restarts from a third click once a route is complete
runs automatically after two cities are chosen on the map
runs the search only once both cities are chosen
runs the selected Rust search and starts playback
selects a city by clicking even after zooming in
shows a useful error when the Wasm search fails
shows final paths only for completed algorithms
shows the all-pairs benchmark and exact selected-route details
starts with nothing selected and no reset button
toggles selecting when the same city is clicked again before a route is complete
updates the route details for the selected starting point and destination
uses one button that switches between play and pause
uses the multiplication sign for the close control
uses the longest algorithm trace as the timeline length
TESTS
missing=""
count=0
while IFS= read -r name; do
  [ -z "$name" ] && continue
  count=$((count + 1))
  grep -rqF "\"$name\"" --include='*.test.ts' --include='*.test.tsx' . 2>/dev/null \
    || missing="$missing
         $name"
done < "$FRONTEND_TESTS_FILE"
if [ -z "$missing" ]; then
  pass "all $count required frontend tests are present"
else
  bad "frontend tests missing -- deleted, or renamed without updating this list:"
  printf '%s\n' "$missing" | sed '/^$/d'
fi

echo
echo "Mutation fault count"
# The number of injected faults is written in two docs and has drifted twice: prevent.md
# said "ten" when there were twelve, and both said "fifteen" the moment M9 was retired.
# Nothing breaks when it is wrong, which is exactly why it goes stale -- so the count is
# written as a digit in both files and checked against the script.
faults=$(grep -cE '^  begin M[0-9]+ ' scripts/verify_mutation.sh)
stale=""
for doc in CLAUDE.md .claude/commands/prevent.md; do
  grep -qE "\*\*$faults\*\* *$|injects \*\*$faults\*\*|Injects \*\*$faults\*\*" "$doc" || stale="$stale $doc"
done
if [ -z "$stale" ]; then
  pass "both docs state $faults injected faults"
else
  bad "verify_mutation.sh injects $faults faults; these do not say so:"
  for doc in $stale; do echo "         $doc"; done
fi

echo
echo "Locked decision — priority-queue tie-break"
# CLAUDE.md locks the tie-break at (f, g, city). Swapping the secondary keys to
# (f, city, g) was measured to produce identical explored order on all 800 start/goal/
# algorithm combinations, so no behavioural gate can see it (verify_mutation.sh, M3).
# Behaviour cannot police this, so the source text does.
#
# Only the BinaryHeap ordering is checked here. make_step() has a second comparator, for
# the order the frontier is displayed in each trace frame; that one is pinned by the
# committed trace goldens instead, because a change there is visible in the output.
#
# The C++ and Python tie-breaks are equally invisible to behavioural gates. They are not
# checked here: three greps over three encodings to pin one decision is more brittleness
# than it buys, and those two are reference implementations rather than the engine.
order=$(sed -n '/impl Ord for QueueEntry/,/^}/p' wasm/src/search.rs \
        | grep -oE 'total_cmp\(&self\.f\)|other\.g\.cmp\(&self\.g\)|other\.city\.cmp\(&self\.city\)' \
        | paste -sd'|' -)
expected='total_cmp(&self.f)|other.g.cmp(&self.g)|other.city.cmp(&self.city)'
if [ "$order" = "$expected" ]; then
  pass "QueueEntry orders by (f, g, city)"
else
  bad "tie-break changed -- CLAUDE.md locks (f, g, city)"
  echo "         expected: $expected"
  echo "         found:    ${order:-<no comparison keys matched>}"
fi

echo
echo "CLAUDE.md — the state table matches the tree"
# The "What exists" table is a fourth encoding of facts that live in the tree, and it was
# the only one with no gate. It drifted: it described public/data/romania.geojson months
# after the file was deleted, called stores/ and lib/wasm/ "Empty" when they held 243 lines
# of working code, and named wasm/src/bin/export.rs, which is export_sample.rs.
#
# Both checks are pure text, so they run in --structural mode too. Neither can police
# whether prose is *true* -- only whether the paths it names exist, and whether a row
# claiming "Empty" still points at an empty file. That is the mechanical part, which is
# also the part that rots silently.
python3 - <<'TABLE' || fail=1
import re, sys, glob, os

text = open("CLAUDE.md", encoding="utf-8").read()
section = re.search(r"^## What exists.*?^---", text, re.S | re.M)
if not section:
    print("  \033[31mFAIL\033[0m CLAUDE.md has no '## What exists' section to check")
    sys.exit(1)
section = section.group(0)

GREEN, RED = "\033[32m", "\033[31m"
OFF = "\033[0m"
bad = 0

def exists(path):
    if "*" in path:
        return bool(glob.glob(path))
    return os.path.exists(path)

# 1. Every backticked path in the section must exist. Only tokens containing a slash are
#    treated as paths; bare words like `verify:parity` and `Cargo.toml` are prose or are
#    ambiguous, and a false failure here would be worse than a missed one. Angle brackets
#    and whitespace rule out JSX (`<RomaniaSearch />`), which also contains a slash.
paths = sorted({
    t for t in re.findall(r"`([^`]+)`", section)
    if "/" in t and "<" not in t and ">" not in t and not re.search(r"\s", t)
})
missing = [t for t in paths if not exists(t)]
if missing:
    print("  %sFAIL%s the state table names %d path(s) that do not exist:" % (RED, OFF, len(missing)))
    for t in missing:
        print("         %s" % t)
    bad = 1
else:
    print("  %sok%s   all %d paths named in the state table exist" % (GREEN, OFF, len(paths)))

# 2. A row whose State cell starts with **Empty must point at files of at most one line.
#    This is the check that would have caught the stores/ row the day the store landed.
wrong = []
for line in section.splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 2 or not cells[1].startswith("**Empty"):
        continue
    for t in re.findall(r"`([^`]+)`", cells[0]):
        for f in (glob.glob(t) if "*" in t else [t]):
            if os.path.isfile(f):
                with open(f, encoding="utf-8", errors="replace") as fh:
                    lines = sum(1 for _ in fh)
                if lines > 1:
                    wrong.append((f, lines))
if wrong:
    print("  %sFAIL%s marked Empty in the state table but not empty:" % (RED, OFF))
    for f, lines in wrong:
        print("         %s (%d lines)" % (f, lines))
    bad = 1
else:
    print("  %sok%s   every row marked Empty points at an empty file" % (GREEN, OFF))

sys.exit(bad)
TABLE

if [ "$STRUCTURAL_ONLY" -eq 1 ]; then
  [ "$fail" -eq 0 ] || echo "invariants: FAIL"
  exit "$fail"
fi

echo
echo "Builds"
if rust_build "$BIN" "$BIN/rs.log" strict; then
  pass "$RUST_TOOL -D warnings"
else
  bad "$RUST_TOOL failed"; sed 's/^/       /' "$BIN/rs.log"
fi

if [ -s wasm/Cargo.toml ]; then
  # Same directory rust_build uses, so check/test/clippy reuse the build it just did.
  CARGO_TARGET="${CARGO_TARGET_DIR:-$BIN/cargo-target}"
  if cargo check --all-targets --manifest-path wasm/Cargo.toml \
      --target-dir "$CARGO_TARGET" >"$BIN/cargo-check.log" 2>&1; then
    pass "cargo check --all-targets"
  else
    bad "cargo check failed"; sed 's/^/       /' "$BIN/cargo-check.log"
  fi

  if cargo test --all-targets --manifest-path wasm/Cargo.toml \
      --target-dir "$CARGO_TARGET" >"$BIN/cargo-test.log" 2>&1; then
    pass "cargo test --all-targets"
  else
    bad "cargo test failed"; sed 's/^/       /' "$BIN/cargo-test.log"
  fi

  if cargo clippy --all-targets --manifest-path wasm/Cargo.toml \
      --target-dir "$CARGO_TARGET" -- -D warnings >"$BIN/clippy.log" 2>&1; then
    pass "cargo clippy --all-targets -- -D warnings"
  else
    bad "cargo clippy failed"; sed 's/^/       /' "$BIN/clippy.log"
  fi

  if cargo fmt --manifest-path wasm/Cargo.toml -- --check >"$BIN/fmt.log" 2>&1; then
    pass "cargo fmt --check"
  else
    bad "cargo fmt failed"; sed 's/^/       /' "$BIN/fmt.log"
  fi
fi

if g++ -std=c++17 -O2 -Wall -Wextra reference/romania_search.cpp -o "$BIN/cpp" 2>"$BIN/cpp.log"; then
  n=$(grep -c 'warning:' "$BIN/cpp.log" || true)
  if [ "$n" -gt 0 ]; then
    # Non-fatal: these are pre-existing and fixing them would be a source change.
    warn "g++ compiled with $n warning(s)"
    grep 'warning:' "$BIN/cpp.log" | sed 's/^/       /'
  else
    pass "g++ -Wall -Wextra"
  fi
else
  bad "g++ failed"; sed 's/^/       /' "$BIN/cpp.log"
fi

if python3 -m py_compile reference/romania_search.py 2>"$BIN/py.log"; then
  pass "python3 -m py_compile"
else
  bad "python compile failed"; sed 's/^/       /' "$BIN/py.log"
fi

echo
[ "$fail" -eq 0 ] && echo "invariants: PASS" || echo "invariants: FAIL"
exit "$fail"
