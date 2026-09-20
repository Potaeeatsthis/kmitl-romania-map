#!/usr/bin/env bash
# Checks that the harness itself is wired up.
#
# Every other verify_*.sh makes a claim about the engine. This one makes a claim about
# the tooling: that the PostToolUse hook in .claude/settings.json actually runs and
# actually reacts, and that the GitHub workflows are wired to the same gates. The hook
# check exists because that hook silently stopped working for the whole life of the
# project and no check noticed -- it branched on an environment variable Claude Code
# does not set, so it matched nothing and exited 0 on every edit. See docs/runbook.md §2.
# The workflow check exists because ci.yml listed the verify gates by hand and fell
# behind `npm run verify` when all-pairs/all-runtimes were added, and because deploy.yml
# used to trigger on the push itself, racing CI.
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
payload "$ROOT/wasm/src/search.rs" > "$BIN/engine.json"
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
    pass "reacts to an edit under wasm/src/"
  else
    bad "silent on an edit under wasm/src/ -- the hook is not wired to anything"
    echo "       command: $command"
  fi
done < "$BIN/commands"

echo
echo "Workflow wiring"
# The two workflows are the last place a gate can silently go missing: nothing compiles
# them, so a check that is never run looks exactly like a check that passed. This does a
# structural scan rather than a raw substring match, because a raw match happily accepts
# a guard that has been commented out and a gate disabled with `if: false` or
# `continue-on-error: true`. It reads indentation, ignores comments, and checks the
# active job/step keys. Then it runs itself against deliberately broken copies -- a
# commented guard, a commented step, a disabled step, a failure-tolerant step, and a
# disabled or failure-tolerant job -- and fails if it does not catch each one.
if python3 - <<'PY'
import json, re, shutil, sys, tempfile
from pathlib import Path

GREEN = "\033[32m"; RED = "\033[31m"; OFF = "\033[0m"
fail = 0


def ok(msg):
    print(f"  {GREEN}ok{OFF}   {msg}")


def bad(msg):
    global fail
    print(f"  {RED}FAIL{OFF} {msg}")
    fail = 1


# -- tiny YAML-subset reader: indentation-aware, comments dropped ----------------------
def active(text):
    out = []
    for raw in text.splitlines():
        if not raw.strip():
            continue
        s = raw.lstrip(" ")
        if s.startswith("#"):
            continue
        out.append((len(raw) - len(s), s.rstrip()))
    return out


def find_key(lines, content, indent, start=0):
    for i in range(start, len(lines)):
        if lines[i][0] == indent and lines[i][1] == content:
            return i
    return -1


def get_job(lines, name):
    j = find_key(lines, "jobs:", 0)
    if j < 0:
        return None
    start = -1
    for i in range(j + 1, len(lines)):
        if lines[i][0] == 0:
            break
        if lines[i][0] == 2 and lines[i][1] == f"{name}:":
            start = i
            break
    if start < 0:
        return None
    out = []
    for i in range(start + 1, len(lines)):
        if lines[i][0] <= 2:
            break
        out.append(lines[i])
    return out


def block_value(pairs, key, indent):
    for i, (ind, c) in enumerate(pairs):
        if ind != indent:
            continue
        m = re.match(rf"^{re.escape(key)}:\s*(.*)$", c)
        if not m:
            continue
        val = m.group(1).strip()
        if val in ("|", "|-", "|+", ">", ">-", ">+"):
            cont = []
            for j in range(i + 1, len(pairs)):
                if pairs[j][0] <= indent:
                    break
                cont.append(pairs[j][1])
            return " ".join(cont)
        return val
    return None


def get_steps(job):
    idx = -1
    for i, (ind, c) in enumerate(job):
        if ind == 4 and c == "steps:":
            idx = i
            break
    if idx < 0:
        return []
    steps = []
    cur = None
    for ind, c in job[idx + 1:]:
        if ind <= 4:
            break
        if ind == 6 and c.startswith("- "):
            if cur is not None:
                steps.append(cur)
            cur = [c[2:].strip()]
        elif cur is not None:
            cur.append(c)
    if cur is not None:
        steps.append(cur)
    return steps


def step_key(step, key):
    for c in step:
        m = re.match(rf"^{re.escape(key)}:\s*(.*)$", c)
        if m:
            val = m.group(1).strip()
            return " " if val in ("|", "|-", "|+", ">", ">-", ">+") else val
    return None


def step_run(step):
    for i, c in enumerate(step):
        m = re.match(r"^run:\s*(.*)$", c)
        if not m:
            continue
        val = m.group(1).strip()
        if val in ("|", "|-", "|+", ">", ">-", ">+"):
            return "\n".join(step[i + 1:])
        return re.sub(r"\s+#.*$", "", val).strip()
    return None


def unexpr(v):
    v = v.strip()
    if v.startswith("${{") and v.endswith("}}"):
        v = v[3:-2].strip()
    return v


def is_truey(v):
    return unexpr(v).lower() in ("true", "1")


def is_falsey(v):
    return unexpr(v).lower() in ("false", "!true", "0", "null", "~", "")


def flow(v):
    v = v.strip()
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
    return [v.strip().strip("'\"")] if v else []


def on_value(on, key):
    for i, (ind, c) in enumerate(on):
        if ind != 4:
            continue
        m = re.match(rf"^{re.escape(key)}:\s*(.*)$", c)
        if not m:
            continue
        val = m.group(1).strip()
        if val:
            return flow(val)
        items = []
        for j in range(i + 1, len(on)):
            if on[j][0] <= 4:
                break
            if on[j][1].startswith("- "):
                items.append(on[j][1][2:].strip().strip("'\""))
        return items
    return []


# -- the checks -----------------------------------------------------------------------
def check(root):
    root = Path(root)
    res = []

    def add(label, good):
        res.append((label, bool(good)))

    pkg = json.loads((root / "package.json").read_text())
    verify_checks = set(re.findall(r"verify:[a-z0-9-]+", pkg["scripts"]["verify"]))

    ci_lines = active((root / ".github/workflows/ci.yml").read_text())
    job = get_job(ci_lines, "correctness")
    if job is None:
        add("ci.yml has a correctness job", False)
    else:
        jif = block_value(job, "if", 4)
        add("ci.yml correctness job is unconditional", jif is None or is_truey(jif))
        jcoe = block_value(job, "continue-on-error", 4)
        add("ci.yml correctness job does not tolerate failure", jcoe is None or is_falsey(jcoe))
        ran = set()
        bad_steps = []
        for s in get_steps(job):
            run = step_run(s)
            if not run:
                continue
            m = re.match(r"^npm run (verify:[a-z0-9-]+)$", run.strip())
            if not m:
                continue
            name = m.group(1)
            sif = step_key(s, "if")
            coe = step_key(s, "continue-on-error")
            if sif is not None and not is_truey(sif):
                bad_steps.append(f"{name} is disabled by if: {sif}")
                continue
            if coe is not None and not is_falsey(coe):
                bad_steps.append(f"{name} tolerates failure (continue-on-error: {coe})")
                continue
            ran.add(name)
        add("ci.yml verify steps are not disabled or failure-tolerant", not bad_steps)
        add("ci.yml correctness job runs every gate of `npm run verify`",
            not (verify_checks - ran))

    dep_lines = active((root / ".github/workflows/deploy.yml").read_text())
    on = []
    oi = find_key(dep_lines, "on:", 0)
    if oi >= 0:
        for i in range(oi + 1, len(dep_lines)):
            if dep_lines[i][0] <= 0:
                break
            on.append(dep_lines[i])
    on_keys = {c[:-1] for ind, c in on if ind == 2 and c.endswith(":")}
    add("deploy.yml triggers on workflow_run", "workflow_run" in on_keys)
    add("deploy.yml has no direct push trigger", "push" not in on_keys)
    add("deploy.yml has no manual dispatch bypass", "workflow_dispatch" not in on_keys)
    add("deploy.yml triggers on the CI workflow", "CI" in on_value(on, "workflows"))
    add("deploy.yml triggers on completion", "completed" in on_value(on, "types"))
    add("deploy.yml only fires for master", "master" in on_value(on, "branches"))

    dep = get_job(dep_lines, "deploy")
    if dep is None:
        add("deploy.yml has a deploy job", False)
    else:
        dif = block_value(dep, "if", 4) or ""
        clauses = [
            "github.event.workflow_run.conclusion == 'success'",
            "github.event.workflow_run.event == 'push'",
            "github.event.workflow_run.head_branch == 'master'",
            "github.event.workflow_run.head_repository.full_name == github.repository",
        ]
        add("deploy job requires CI success, push, master, this repo",
            all(c in dif for c in clauses))
        add("deploy job is gated on the freshness output",
            "needs.freshness.outputs.current == 'true'" in dif)
        steps = get_steps(dep)
        checkout = [s for s in steps if any(c.startswith("uses: actions/checkout@") for c in s)]
        add("deploy job checks out a ref", len(checkout) == 1)
        if checkout:
            add("deploy job checks out the verified head_sha",
                step_key(checkout[0], "ref") == "${{ github.event.workflow_run.head_sha }}")
        add("deploy job re-resolves master before publishing",
            any("git ls-remote origin refs/heads/master" in (step_run(s) or "") for s in steps))
        for uses, label in [
            ("actions/configure-pages@", "Configure Pages"),
            ("actions/upload-pages-artifact@", "Upload artifact"),
            ("actions/deploy-pages@", "Deploy"),
        ]:
            step = [s for s in steps if any(c.startswith(f"uses: {uses}") for c in s)]
            gated = (bool(step)
                     and step_key(step[0], "if") == "steps.final.outputs.current == 'true'")
            add(f"{label} is gated on the final freshness check", gated)

    fresh = get_job(dep_lines, "freshness")
    if fresh is None:
        add("deploy.yml has a pre-build freshness job", False)
    else:
        fsteps = get_steps(fresh)
        add("freshness job resolves master's head",
            any("git ls-remote origin refs/heads/master" in (step_run(s) or "") for s in fsteps))
        fcheckout = [s for s in fsteps if any(c.startswith("uses: actions/checkout@") for c in s)]
        add("freshness job checks out the verified head_sha",
            len(fcheckout) == 1
            and step_key(fcheckout[0], "ref") == "${{ github.event.workflow_run.head_sha }}")
        add("freshness job publishes a current output",
            any("current=" in (step_run(s) or "") for s in fsteps))
    return res


# -- negative tests: the check must fail on each broken copy --------------------------
def _base(d):
    (d / ".github/workflows").mkdir(parents=True)
    shutil.copy("package.json", d / "package.json")
    shutil.copy(".github/workflows/ci.yml", d / ".github/workflows/ci.yml")
    shutil.copy(".github/workflows/deploy.yml", d / ".github/workflows/deploy.yml")


def commented_guard(d):
    _base(d)
    f = d / ".github/workflows/deploy.yml"
    f.write_text("\n".join(
        ("# " + ln) if "workflow_run.conclusion == 'success'" in ln else ln
        for ln in f.read_text().splitlines()))


def commented_step(d):
    _base(d)
    f = d / ".github/workflows/ci.yml"
    f.write_text("\n".join(
        ("# " + ln) if "npm run verify:all-pairs" in ln else ln
        for ln in f.read_text().splitlines()))


def step_if_false(d):
    _base(d)
    f = d / ".github/workflows/ci.yml"
    f.write_text(f.read_text().replace(
        "      - name: All-pairs data freshness\n        run: npm run verify:all-pairs\n",
        "      - name: All-pairs data freshness\n        if: false\n"
        "        run: npm run verify:all-pairs\n"))


def step_continue_on_error(d):
    _base(d)
    f = d / ".github/workflows/ci.yml"
    f.write_text(f.read_text().replace(
        "        run: npm run verify:all-pairs\n",
        "        run: npm run verify:all-pairs\n        continue-on-error: true\n"))


def job_if_false(d):
    _base(d)
    f = d / ".github/workflows/ci.yml"
    f.write_text(f.read_text().replace(
        "  correctness:\n    name: Invariants, parity, correctness\n",
        "  correctness:\n    name: Invariants, parity, correctness\n    if: false\n"))


def job_continue_on_error(d):
    _base(d)
    f = d / ".github/workflows/ci.yml"
    f.write_text(f.read_text().replace(
        "  correctness:\n    name: Invariants, parity, correctness\n",
        "  correctness:\n    name: Invariants, parity, correctness\n"
        "    continue-on-error: true\n"))


for label, good in check(Path(".")):
    ok(label) if good else bad(label)

for label, mutate in [
    ("a commented-out deploy guard", commented_guard),
    ("a commented-out verify step", commented_step),
    ("a verify step with if: false", step_if_false),
    ("a verify step with continue-on-error: true", step_continue_on_error),
    ("a correctness job with if: false", job_if_false),
    ("a correctness job with continue-on-error: true", job_continue_on_error),
]:
    with tempfile.TemporaryDirectory() as td:
        mutate(Path(td))
        caught = any(not good for _, good in check(Path(td)))
    ok(f"rejects {label}") if caught else bad(f"does not reject {label}")

sys.exit(1 if fail else 0)
PY
then
  :
else
  fail=1
fi

echo
[ "$fail" -eq 0 ] && echo "harness: PASS" || echo "harness: FAIL"
exit "$fail"
