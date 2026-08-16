#!/usr/bin/env bash
# Invariant I2 — Rust, C++ and Python must agree exactly.
#
# This is the project's central claim: the same algorithm in three languages,
# producing the same result. Drift is silent -- all three keep running and keep
# finding optimal paths, but the reported expansion counts stop matching and
# every number in the report becomes wrong. Nothing else catches that.
#
# Runtimes vary run to run, so only deterministic fields are compared:
# route, explored order, expanded, generated, peak queue, peak records, memory.
#
# Run via: npm run verify:parity
set -uo pipefail

cd "$(dirname "$0")/.."
BIN="$(mktemp -d)"
trap 'rm -rf "$BIN"' EXIT
fail=0

CITIES=(
  Arad Zerind Oradea Sibiu Timisoara Lugoj Mehadia Drobeta Craiova "Rimnicu Vilcea"
  Pitesti Fagaras Bucharest Giurgiu Urziceni Hirsova Eforie Vaslui Iasi Neamt
)

# 41 routes: every city appears as both a start and a goal, paired at two different
# offsets so the sample spans short hops and cross-map traversals, plus one same-city
# route as an edge case. A single python run costs ~0.12 s, so this stays under ~7 s.
# A full 400-pair sweep would cost ~60 s for little extra signal -- verify_correctness.py
# already covers all 400 pairs within one implementation.
ROUTES=()
for i in $(seq 0 19); do
  ROUTES+=("${CITIES[$i]}|${CITIES[$(( (i + 7)  % 20 ))]}")
  ROUTES+=("${CITIES[$i]}|${CITIES[$(( (i + 13) % 20 ))]}")
done
ROUTES+=("Sibiu|Sibiu")

echo "Building all three implementations"
rustc --edition=2021 -O server/src/main.rs -o "$BIN/rs" 2>"$BIN/build.log" \
  || { echo "  FAIL rustc"; sed 's/^/       /' "$BIN/build.log"; exit 1; }
g++ -std=c++17 -O2 reference/romania_search.cpp -o "$BIN/cpp" 2>>"$BIN/build.log" \
  || { echo "  FAIL g++"; sed 's/^/       /' "$BIN/build.log"; exit 1; }
echo "  ok   rustc, g++, python3"
echo
echo "Comparing ${#ROUTES[@]} routes across three languages"
agreed=0

# Keep only fields that are identical on every machine and every run.
canon() {
  awk '
    /^UCS: /                             { print "route " $0; next }
    /^Current-flow A\*: /                { print "route " $0; next }
    /^UCS[[:space:]]+[0-9]/              { print "ucs  ", $(NF-4), $(NF-3), $(NF-2), $(NF-1), $NF; next }
    /^Current-flow A\*[[:space:]]+[0-9]/ { print "astar", $(NF-4), $(NF-3), $(NF-2), $(NF-1), $NF; next }
  '
}

for route in "${ROUTES[@]}"; do
  start="${route%%|*}"
  goal="${route##*|}"
  input="$(printf '%s\n%s\n' "$start" "$goal")"

  echo "$input" | "$BIN/rs"                        2>/dev/null | canon > "$BIN/out.rs"
  echo "$input" | "$BIN/cpp"                       2>/dev/null | canon > "$BIN/out.cpp"
  echo "$input" | python3 reference/romania_search.py 2>/dev/null | canon > "$BIN/out.py"

  if [ ! -s "$BIN/out.rs" ]; then
    printf '  \033[31mFAIL\033[0m %s -> %s: no parseable output\n' "$start" "$goal"
    fail=1
    continue
  fi

  if diff -q "$BIN/out.rs" "$BIN/out.cpp" >/dev/null && \
     diff -q "$BIN/out.rs" "$BIN/out.py"  >/dev/null; then
    agreed=$((agreed + 1))
  else
    printf '  \033[31mFAIL\033[0m %s -> %s\n' "$start" "$goal"
    echo "       rust vs cpp:"
    diff "$BIN/out.rs" "$BIN/out.cpp" | sed 's/^/         /'
    echo "       rust vs python:"
    diff "$BIN/out.rs" "$BIN/out.py" | sed 's/^/         /'
    fail=1
  fi
done

printf '  \033[32mok\033[0m   %d/%d routes agree on every deterministic field\n' \
  "$agreed" "${#ROUTES[@]}"

echo
[ "$fail" -eq 0 ] && echo "parity: PASS" || echo "parity: FAIL"
exit "$fail"
