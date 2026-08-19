#!/usr/bin/env bash
# Golden baseline — the full CLI output, pinned to a committed reference.
#
# verify_parity.sh compares the three implementations to *each other*, which cannot
# catch a change made to all three at once. The road table lives in three separate
# encodings (Rust index triples, C++ index triples, Python name pairs), so adding or
# correcting a road means editing all three -- parity stays green while every reported
# number changes. This script is the fixed point that catches that.
#
# It is also what makes build step 1's acceptance criterion runnable: "output
# byte-identical to today's" needs a record of today's output.
#
# Only three values in the output are nondeterministic -- the two runtime columns and
# the heuristic build time -- so they are masked as <time> rather than dropped, and
# Python's thousands separator is normalised. Everything else is compared verbatim,
# including column alignment.
#
# Run via: npm run verify:golden
# Re-record after an intended output change: bash scripts/verify_golden.sh --update
set -uo pipefail

cd "$(dirname "$0")/.."
. scripts/lib/rust_build.sh
BIN="$(mktemp -d)"
trap 'rm -rf "$BIN"' EXIT
fail=0

GOLDEN_DIR="tests/golden"

# slug|start|goal -- the documented example, a long cross-map traversal, and the
# degenerate same-city case.
ROUTES=(
  "arad-bucharest|Arad|Bucharest"
  "drobeta-neamt|Drobeta|Neamt"
  "sibiu-sibiu|Sibiu|Sibiu"
)

UPDATE=0
[ "${1:-}" = "--update" ] && UPDATE=1

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

# Mask the three nondeterministic numbers, including their right-alignment padding so
# that a 0.764 us run and an 11.508 us run collapse to the same token. Normalise
# Python's "5,000" against Rust's and C++'s "5000".
mask() {
  sed -E -e 's/[[:space:]]*[0-9]+\.[0-9]{3}/<time>/g' -e 's/5,000/5000/g'
}

echo "Building all three implementations"
rust_build "$BIN" "$BIN/build.log" cli \
  || { echo "  FAIL $RUST_TOOL"; sed 's/^/       /' "$BIN/build.log"; exit 1; }
g++ -std=c++17 -O2 reference/romania_search.cpp -o "$BIN/cpp" 2>>"$BIN/build.log" \
  || { echo "  FAIL g++"; sed 's/^/       /' "$BIN/build.log"; exit 1; }
echo "  ok   $RUST_TOOL, g++, python3"
echo

mkdir -p "$GOLDEN_DIR"
[ "$UPDATE" -eq 1 ] && echo "Re-recording ${#ROUTES[@]} golden files" \
                    || echo "Comparing ${#ROUTES[@]} routes against $GOLDEN_DIR"

known=""
for entry in "${ROUTES[@]}"; do
  IFS='|' read -r slug start goal <<< "$entry"
  known="$known $slug"
  golden="$GOLDEN_DIR/$slug.txt"
  input="$(printf '%s\n%s\n' "$start" "$goal")"

  echo "$input" | "$RUST_BIN"                         2>/dev/null | mask > "$BIN/$slug.rs"
  echo "$input" | "$BIN/cpp"                          2>/dev/null | mask > "$BIN/$slug.cpp"
  echo "$input" | python3 reference/romania_search.py 2>/dev/null | mask > "$BIN/$slug.py"

  if [ ! -s "$BIN/$slug.rs" ]; then
    bad "$start -> $goal: rust produced no output"
    continue
  fi

  # All three must agree before anything is recorded, so --update can never bless
  # output that only one implementation produces.
  disagreed=0
  for impl in cpp py; do
    if ! diff -q "$BIN/$slug.rs" "$BIN/$slug.$impl" >/dev/null; then
      bad "$slug: rust and $impl disagree -- fix that before touching the golden file"
      diff "$BIN/$slug.rs" "$BIN/$slug.$impl" | sed 's/^/       /'
      disagreed=1
    fi
  done
  [ "$disagreed" -eq 1 ] && continue

  if [ "$UPDATE" -eq 1 ]; then
    cp "$BIN/$slug.rs" "$golden"
    pass "recorded $golden"
    continue
  fi

  if [ ! -f "$golden" ]; then
    bad "$golden is missing -- run: bash scripts/verify_golden.sh --update"
    continue
  fi

  if diff -q "$golden" "$BIN/$slug.rs" >/dev/null; then
    pass "$slug matches the recorded output"
  else
    bad "$slug differs from $golden"
    diff "$golden" "$BIN/$slug.rs" | sed 's/^/       /'
  fi
done

# A golden file whose route was removed from ROUTES is never compared against anything,
# so it rots silently and reads as coverage the project does not have.
for existing in "$GOLDEN_DIR"/*.txt; do
  [ -e "$existing" ] || continue
  slug="$(basename "$existing" .txt)"
  case " $known " in
    *" $slug "*) ;;
    *) bad "$existing has no matching route in ROUTES -- delete it, or add the route back" ;;
  esac
done

echo
if [ "$UPDATE" -eq 1 ]; then
  [ "$fail" -eq 0 ] && echo "golden: RECORDED -- review the diff before committing" \
                    || echo "golden: FAIL"
else
  [ "$fail" -eq 0 ] && echo "golden: PASS" || {
    echo "golden: FAIL"
    echo
    echo "A difference here is not automatically a bug. If the change to the CLI output"
    echo "was intended, read the diff, confirm it is what you meant, then re-record:"
    echo "    bash scripts/verify_golden.sh --update"
    echo "See docs/runbook.md for when a golden diff means a real regression."
  }
fi
exit "$fail"
