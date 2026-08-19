#!/usr/bin/env bash
# PostToolUse hook — runs after every Edit and Write.
#
# Two things this file exists to get right, both of which the previous inline version
# got wrong (see docs/runbook.md §2):
#
#   1. The payload arrives as JSON on stdin, not in the environment. There is no
#      CLAUDE_TOOL_INPUT_FILE_PATH variable; the edited path is .tool_input.file_path.
#      CLAUDE_PROJECT_DIR *is* set, so that part is used as-is.
#   2. On exit 0, stdout goes to the debug log where nobody reads it. To put text in
#      front of Claude, either exit 2 with the message on stderr, or print JSON with a
#      systemMessage field. A violation uses the first; the parity reminder uses the
#      second, because it is a notice rather than a failure.
#
# Kept as a script rather than a one-liner in settings.json so that it is readable and
# so scripts/verify_harness.sh can exercise the real thing.
set -uo pipefail

payload="$(cat)"

# A missing interpreter must not look like a missing file path. Swallowing that
# difference is how the previous version of this hook died quietly for weeks: any
# failure to resolve the path became a silent exit 0. python3 is already required by
# npm run verify:correctness and by reference/romania_search.py, so if it is absent the
# harness is broken, not merely this hook.
if ! command -v python3 >/dev/null 2>&1; then
  echo "post_tool_use hook: python3 not found on PATH; invariant checks are not running." >&2
  exit 2
fi

file_path="$(
  printf '%s' "$payload" | python3 -c \
    'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' \
    2>/dev/null
)"

# Not a file-shaped tool call, or a payload shape we do not recognise: stay quiet.
[ -z "$file_path" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

# I1 and I4 are grep-based, so this is fast enough to run on every keystroke-level edit.
# --structural skips the compilers for the same reason.
case "$file_path" in
  */wasm/src/*)
    if ! out="$(bash "$root/scripts/verify_invariants.sh" --structural 2>&1)"; then
      {
        echo "Invariant check failed after editing $file_path"
        echo "$out"
        echo "Run /prevent for the full picture."
      } >&2
      exit 2
    fi
    ;;
esac

case "$file_path" in
  */reference/romania_search.*|*/wasm/src/*)
    printf '%s\n' '{"systemMessage":"Algorithm file touched - I2 requires matching behavior in Rust, Python, and C++ (wasm/src and reference/romania_search.* during migration). Run: npm run verify:parity"}'
    ;;
esac

exit 0
