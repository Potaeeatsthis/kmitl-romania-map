#!/usr/bin/env bash
# Preflight — is this machine able to run the project's checks and build?
#
# Every other verify_*.sh assumes its tools are present and dies with the shell's own
# error if they are not. `npm run build` on a machine without wasm-pack fails with
# "sh: wasm-pack: command not found" and no indication of what wasm-pack is, why it is
# needed, or how to get it -- the answer exists only in CLAUDE.md's gotchas, which is
# not where anyone looks while staring at a stack trace.
#
# Split into two sections deliberately. Everything under "verification" is needed for
# `npm run verify`; wasm-pack is needed only for `npm run build` and the browser bundle.
# A machine that has the first set and not the second can still do useful work, and
# saying so is more useful than one undifferentiated list of red crosses.
#
# Run via: npm run doctor
set -uo pipefail

cd "$(dirname "$0")/.."
missing_verify=0
missing_build=0

pass() { printf '  \033[32mok\033[0m   %-14s %s\n' "$1" "$2"; }
bad()  { printf '  \033[31mmiss\033[0m %-14s %s\n' "$1" "$2"; }

# have <name> <command> <install hint> <bucket>
have() {
  local name="$1" cmd="$2" hint="$3" bucket="$4" version
  if command -v "$cmd" >/dev/null 2>&1; then
    version="$("$cmd" --version 2>&1 | head -1)"
    pass "$name" "$version"
  else
    bad "$name" "$hint"
    [ "$bucket" = "verify" ] && missing_verify=1 || missing_build=1
  fi
}

echo "Needed for npm run verify"
have node    node    "https://nodejs.org -- see .nvmrc for the version"        verify
have cargo   cargo   "https://rustup.rs"                                      verify
have rustc   rustc   "https://rustup.rs"                                      verify
have g++     g++     "xcode-select --install (macOS) / apt install g++"       verify
have python3 python3 "https://python.org, or your package manager"            verify

echo
echo "Needed for npm run build and the browser bundle"

# rust-toolchain.toml declares the target, but rustup only installs it on demand, and
# the failure surfaces mid-build rather than here.
if rustup target list --installed 2>/dev/null | grep -q '^wasm32-unknown-unknown$'; then
  pass "wasm32 target" "installed"
else
  bad "wasm32 target" "rustup target add wasm32-unknown-unknown"
  missing_build=1
fi

# Presence is not enough: CI pins wasm-pack via .wasm-pack-version, so a machine on a
# different version can produce a different bundle from the same source. Read the pin
# from the same file CI reads, and report a mismatch rather than a bare "ok".
WANT="$(tr -d '[:space:]' < .wasm-pack-version 2>/dev/null)"
if command -v wasm-pack >/dev/null 2>&1; then
  GOT="$(wasm-pack --version 2>/dev/null | awk '{print $2}')"
  if [ -z "$WANT" ] || [ "$GOT" = "$WANT" ]; then
    pass "wasm-pack" "wasm-pack $GOT"
  else
    bad "wasm-pack" "have $GOT, project pins $WANT -- see .wasm-pack-version"
    missing_build=1
  fi
else
  bad "wasm-pack" "install v${WANT:-latest} from https://github.com/rustwasm/wasm-pack/releases"
  missing_build=1
fi

# node_modules is not a command, and its absence is the other way `npm test` fails
# confusingly -- vitest resolves to nothing and the shell reports command not found.
echo
echo "Workspace"
if [ -d node_modules ]; then
  pass "node_modules" "installed"
else
  bad "node_modules" "npm ci"
  missing_verify=1
fi

echo
if [ "$missing_verify" -eq 0 ] && [ "$missing_build" -eq 0 ]; then
  echo "doctor: PASS — npm run verify:all and npm run build should both work"
  exit 0
elif [ "$missing_verify" -eq 0 ]; then
  echo "doctor: PARTIAL — npm run verify:all will work; npm run build will not"
  exit 1
else
  echo "doctor: FAIL — npm run verify:all cannot run on this machine yet"
  exit 1
fi
