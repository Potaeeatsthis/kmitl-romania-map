#!/usr/bin/env bash
# Regression check for the Node version gate in scripts/verify_env.sh.
#
# The doctor used to only ask whether `node` existed, so a machine on Node 22 printed
# `ok` while package.json required >=24 -- the false positive this guards. A fake `node`
# on PATH supplies an old, a floor, and a newer version; a sanitized PATH supplies the
# missing case. The requirement is read from package.json's engines field, so a bump
# moves the test with it rather than pinning a second copy of the major here.
#
# The remaining cases pin the contract the doctor advertises: only the whole `>=N`
# (optionally `>=N.M`) pattern is accepted -- a patch-level floor or a range must fail
# loudly -- and the requirement is read through a JSON parser, so an unrelated nested
# "node" key cannot be mistaken for it.
#
# Run directly: bash tests/verify_env.test.sh
set -uo pipefail

cd "$(dirname "$0")/.."
doctor="scripts/verify_env.sh"
fail=0

pass() { printf '  ok   %s\n' "$1"; }
bad()  { printf '  FAIL %s\n' "$1"; fail=1; }

strip_ansi() { sed -E $'s/\033\\[[0-9;]*m//g'; }

# Only the node line is inspected, so the other tools the doctor probes -- and their
# presence or absence on this machine -- cannot affect the verdict.
node_line() { # <repo dir> <PATH value>
  ( cd "$1" && PATH="$2" bash "$doctor" 2>&1 ) \
    | strip_ansi | grep -E '^  (ok   |miss )node ' || true
}

req="$(python3 -c 'import json; print(json.load(open("package.json"))["engines"]["node"])')"
req_major="${req#>=}"; req_major="${req_major%%.*}"
if ! [[ "$req_major" =~ ^[0-9]+$ ]]; then
  echo "cannot run: package.json engines.node is '$req', expected '>=N'"
  exit 1
fi
old="$((req_major - 1)).0.0"
floor="${req_major}.0.0"
newer="$((req_major + 1)).3.1"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"
cat > "$tmp/bin/node" <<'SH'
#!/usr/bin/env bash
echo "v${FAKE_NODE_VERSION:?FAKE_NODE_VERSION unset}"
SH
chmod +x "$tmp/bin/node"

assert_line() { # <label> <got> <expected substring>
  if printf '%s' "$2" | grep -qF -- "$3"; then
    pass "$1"
  else
    bad "$1 — wanted '$3', got: ${2:-<no node line>}"
  fi
}

expect() { # <label> <fake version> <expected substring>
  local got
  got="$(FAKE_NODE_VERSION="$2" node_line . "$tmp/bin:$PATH")"
  assert_line "$1" "$got" "$3"
}

expect "old node rejected"   "$old"   "node $old installed, requires >=$req_major -- nvm install && nvm use"
expect "floor node accepted" "$floor" "node $floor (requires >=$req_major)"
expect "newer node accepted" "$newer" "node $newer (requires >=$req_major)"

# Missing node: drop node's directory from PATH. Skip rather than mislead if node shares
# a system directory with the shell tools the doctor itself needs.
node_dir="$(dirname "$(command -v node)")"
without="$(printf '%s' "$PATH" | tr ':' '\n' | grep -vFx "$node_dir" | paste -sd: -)"
if ! PATH="$without" command -v node >/dev/null 2>&1 \
  && PATH="$without" command -v grep >/dev/null 2>&1; then
  got="$(node_line . "$without")"
  assert_line "missing node reported with install hint" "$got" \
    "not found, requires >=$req_major -- nvm install && nvm use"
else
  echo "  skip missing-node case (node shares a directory with system tools)"
fi

# The doctor must refuse patterns outside the `>=N[.M]` contract, not narrow them to the
# leading major. Each pattern gets a copied doctor and its own package.json.
copy_doctor() { # <repo dir>
  mkdir -p "$1/scripts"
  cp "$doctor" "$1/scripts/verify_env.sh"
}
for pattern in ">=$req_major.5.9" ">=$req_major <$((req_major + 1))" "^$req_major"; do
  repo="$tmp/pattern-$(printf '%s' "$pattern" | tr -c '[:alnum:]' '-')"
  copy_doctor "$repo"
  printf '{"engines":{"node":"%s"}}\n' "$pattern" > "$repo/package.json"
  got="$(FAKE_NODE_VERSION="$floor" node_line "$repo" "$tmp/bin:$PATH")"
  assert_line "unsupported pattern '$pattern' fails clearly" "$got" "cannot decide support"
done

# An unrelated nested "node" key must not be read as the requirement: python3/node read
# engines.node, a grep for the first `"node"` would have picked the decoy below.
repo="$tmp/nested"
copy_doctor "$repo"
printf '{"tool":{"node":"^99"},"engines":{"node":">=%s"}}\n' "$req_major" > "$repo/package.json"
got="$(FAKE_NODE_VERSION="$floor" node_line "$repo" "$tmp/bin:$PATH")"
assert_line "nested unrelated node key ignored" "$got" "node $floor (requires >=$req_major)"

# python3 absent: the requirement is still read, through the node fallback, so a machine
# with no python3 does not get a misleading "cannot read" from the node check itself.
min="$tmp/min"
mkdir -p "$min"
for c in grep tr awk head sed dirname bash; do ln -sf "$(command -v "$c")" "$min/$c"; done
ln -sf "$(command -v node)" "$min/node"
got="$(node_line . "$min")"
assert_line "python3 absent falls back to node" "$got" "requires >=$req_major"

echo
if [ "$fail" -eq 0 ]; then
  echo "verify_env.test: PASS"
else
  echo "verify_env.test: FAIL"
fi
exit "$fail"
