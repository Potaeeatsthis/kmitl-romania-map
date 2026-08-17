#!/usr/bin/env bash
# Checks that the harness itself is wired up.
#
# Every other verify_*.sh makes a claim about the engine. This one makes a claim about
# the tooling: that the PostToolUse hook in .claude/settings.json actually runs and
# actually reacts. It exists because that hook silently stopped working for the whole
# life of the project and no check noticed -- it branched on an environment variable
# Claude Code does not set, so it matched nothing and exited 0 on every edit.
# See docs/runbook.md §2.
#
# The command under test is read out of settings.json rather than copied into this file.
# A copy would pass while the real hook rotted, which is the same drift problem the
# parity check exists to prevent.
#
# This lives outside verify_invariants.sh on purpose: the hook it invokes runs
# verify_invariants.sh --structural, so an I1 or I4 violation would otherwise light up
# two unrelated checks and point at the tooling when the engine is what broke.
#
# Run via: npm run verify:harness
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
BIN="$(mktemp -d)"
trap 'rm -rf "$BIN"' EXIT
fail=0

pass() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }

SETTINGS=".claude/settings.json"

echo "Hook wiring"

if [ ! -f "$SETTINGS" ]; then
  bad "$SETTINGS is missing"
  echo; echo "harness: FAIL"; exit 1
fi

if python3 -c "import json,sys; json.load(open('$SETTINGS'))" 2>"$BIN/json.log"; then
  pass "$SETTINGS is valid JSON"
else
  bad "$SETTINGS is not valid JSON"; sed 's/^/       /' "$BIN/json.log"
  echo; echo "harness: FAIL"; exit 1
fi

# The specific regression that started this: branching on an environment variable that
# does not exist. The payload arrives as JSON on stdin.
if grep -q 'CLAUDE_TOOL_INPUT' "$SETTINGS"; then
  bad "$SETTINGS references CLAUDE_TOOL_INPUT* -- no such variable; read .tool_input.file_path from stdin"
else
  pass "no reference to a nonexistent CLAUDE_TOOL_INPUT* variable"
fi

# Pull the real PostToolUse commands out of the settings file. Written to a file rather
# than an array because macOS ships bash 3.2: no mapfile, and empty arrays trip set -u.
python3 - "$SETTINGS" > "$BIN/commands" <<'PY'
import json, sys
settings = json.load(open(sys.argv[1]))
for entry in settings.get("hooks", {}).get("PostToolUse", []):
    for hook in entry.get("hooks", []):
        if hook.get("type") == "command" and hook.get("command"):
            print(hook["command"])
PY

count=$(grep -c . "$BIN/commands" || true)
if [ "$count" -eq 0 ]; then
  bad "no PostToolUse command hooks configured"
  echo; echo "harness: FAIL"; exit 1
fi
pass "$count PostToolUse command hook(s) configured"

# Feed each hook a payload in the documented shape and check it reacts to an engine
# file and stays quiet on an unrelated one.
payload() {
  python3 -c 'import json,sys; print(json.dumps({
    "session_id": "verify-harness",
    "transcript_path": "/dev/null",
    "cwd": sys.argv[1],
    "hook_event_name": "PostToolUse",
    "tool_name": "Edit",
    "tool_input": {"file_path": sys.argv[2]},
    "tool_use_id": "verify-harness"
  }))' "$ROOT" "$1"
}

echo
echo "Hook behaviour"
# Redirect from a file rather than piping: a hook that ignores stdin makes the writer
# die with EPIPE, and under `set -o pipefail` that nonzero status would look like the
# hook reacting when it did nothing at all.
payload "$ROOT/server/src/main.rs" > "$BIN/engine.json"
payload "$ROOT/README.md"          > "$BIN/other.json"

while IFS= read -r command; do
  [ -z "$command" ] && continue
  engine_out="$(CLAUDE_PROJECT_DIR="$ROOT" bash -c "$command" <"$BIN/engine.json" 2>&1)"
  engine_status=$?
  other_out="$(CLAUDE_PROJECT_DIR="$ROOT" bash -c "$command" <"$BIN/other.json" 2>&1)"
  other_status=$?

  # The unrelated file is checked first because it doubles as a health check: a hook
  # whose script has been deleted or renamed errors on *every* payload, which would
  # otherwise be credited below as the hook reacting.
  healthy=1
  if [ "$other_status" -ne 0 ]; then
    bad "the hook command itself failed -- deleted, renamed, or not executable?"
    echo "       command: $command"
    echo "$other_out" | sed 's/^/       /'
    healthy=0
  elif [ -n "$other_out" ]; then
    bad "fired on README.md, which it should ignore"
    echo "$other_out" | sed 's/^/       /'
  else
    pass "quiet on an unrelated file"
  fi

  if [ "$healthy" -eq 0 ]; then
    : # already reported; an engine-file result means nothing while the command is broken
  elif [ -n "$engine_out" ] || [ "$engine_status" -ne 0 ]; then
    pass "reacts to an edit under server/src/"
  else
    bad "silent on an edit under server/src/ -- the hook is not wired to anything"
    echo "       command: $command"
  fi
done < "$BIN/commands"

echo
[ "$fail" -eq 0 ] && echo "harness: PASS" || echo "harness: FAIL"
exit "$fail"
