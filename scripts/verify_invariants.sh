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
if [ -s wasm/src/search.rs ]; then
  count=$(grep -cE '^(pub )?fn search\(' wasm/src/search.rs || true)
  where="wasm/src/search.rs"
else
  count=$(grep -cE '^(pub )?fn search\(' reference/romania_search.rs || true)
  where="reference/romania_search.rs"
fi
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
wasm_engine_file=$(find wasm/src -type f -name '*.rs' -size +0c -print -quit)
if [ -n "$wasm_engine_file" ]; then
  # Once implementation starts, every Rust source file except native CLI binaries is engine code.
  hits=$(find wasm/src -type f -name '*.rs' ! -path '*/bin/*' -exec \
         grep -nHE "$BANNED" {} + 2>/dev/null || true)
  scope="wasm/src excluding wasm/src/bin"
else
  # Pre-restructure: everything is in the native reference, so inspect its engine region --
  # from the first constant to the start of the benchmark harness.
  start=$(grep -n '^const CITY_COUNT' reference/romania_search.rs | cut -d: -f1)
  end=$(grep -n '^fn benchmark' reference/romania_search.rs | cut -d: -f1)
  hits=$(sed -n "${start},${end}p" reference/romania_search.rs | grep -nE "$BANNED" || true)
  scope="reference/romania_search.rs lines ${start}-${end}"
fi
if [ -z "$hits" ]; then
  pass "no banned symbols in $scope"
else
  bad "banned symbols found in $scope:"
  echo "$hits" | sed 's/^/       /'
fi

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
