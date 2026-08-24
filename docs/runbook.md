# Runbook

One section per known failure, in the same order as the signature table in
`.claude/commands/diagnose.md`. Each section is: **symptom → diagnose → fix → prevent**.

New sections are added by step 2 of the bug loop protocol in `CLAUDE.md`. Do not add a
section for a failure that has not actually occurred.

---

## §1 — `empty-cargo-manifest`

Rootcause file: [`rootcause/empty-cargo-manifest.json`](rootcause/empty-cargo-manifest.json)

### Symptom

Any cargo command run inside `wasm/` fails immediately:

```
error: failed to parse manifest at `/…/wasm/Cargo.toml`

Caused by:
  manifest is missing either a `[package]` or a `[workspace]`
```

### Diagnose

```bash
wc -c wasm/Cargo.toml          # 0 → this is the cause
git ls-files wasm | while read f; do [ -s "$f" ] || echo "EMPTY: $f"; done
```

At the time, the Rust source and test placeholders under `wasm/` were empty too — the
directory structure had been committed before the Cargo project was created. All of them
are populated now; this section is kept as the record of the failure, not as a
description of the current tree.

### Fix

This was the expected state before build step 1. The permanent fix is now implemented:

```bash
cargo check --manifest-path wasm/Cargo.toml
```

### Prevent

This entry is historical. `npm run verify:invariants` now runs Cargo check, tests,
Clippy with warnings denied, and the formatting check.

---

## §2 — `dead-posttooluse-hook`

Rootcause file: [`rootcause/dead-posttooluse-hook.json`](rootcause/dead-posttooluse-hook.json)

### Symptom

**There is no error message.** This failure presents as silence: you edit a file under
`wasm/src/`, and nothing appears — no invariant check, no reminder that I2 needs the
same change in all three languages. A working hook and a dead hook look identical from
the outside, which is why this survived from the day it was written.

The tell is that `scripts/verify_invariants.sh --structural` exists solely to be called
by this hook, and had never run.

### Diagnose

```bash
npm run verify:harness          # the direct check
grep CLAUDE_TOOL_INPUT .claude/settings.json   # any hit is the bug
```

Two distinct faults, and a hook can have either:

1. **Wrong input channel.** There is no `CLAUDE_TOOL_INPUT_FILE_PATH`. The payload is
   JSON on **stdin**; the edited path is `.tool_input.file_path`. `CLAUDE_PROJECT_DIR`
   *is* a real variable and can be used directly.
2. **Wrong output channel.** On exit 0, a hook's stdout goes to the debug log where
   nobody reads it. To put text in front of Claude, write to **stderr and exit 2**, or
   print JSON containing a **`systemMessage`** field.

A hook can be perfectly correct about the file path and still be invisible because of
the second point.

### Fix

Logic lives in [`.claude/hooks/post_tool_use.sh`](../.claude/hooks/post_tool_use.sh),
not inline in `settings.json` — a shell one-liner escaped inside JSON is unreadable and
untestable, which is how this went unnoticed. The script parses stdin with `python3`
(`jq` is not a project dependency), fails loudly on stderr with exit 2, and uses
`systemMessage` for the non-failure reminder.

### Prevent

`npm run verify:harness`, wired into `npm run verify` and CI. It reads the command
string out of `.claude/settings.json` and runs it against a synthetic payload, so it
tests the real hook rather than a copy that could drift from it. It asserts the hook
reacts to a `wasm/src/` path, stays quiet on an unrelated one, and that
`settings.json` never mentions `CLAUDE_TOOL_INPUT*` again.

Deliberately a separate script from `verify_invariants.sh`: the hook calls that script,
so a self-check living inside it would turn one I1 violation into two red checks and
point at the tooling when the engine is what broke.

---

## §3 — golden baseline diffs

Rootcause file: none — this is not a bug, it is how to read a check.

### Symptom

```
golden: FAIL
  FAIL arad-bucharest differs from tests/golden/arad-bucharest.txt
```

### Diagnose

**A golden diff is not automatically a regression.** Read the diff and decide which of
two things happened:

- **You changed the CLI output on purpose** — renamed a column, added a metric, adjusted
  wording. Expected. Re-record.
- **A number changed that you did not intend to change** — a cost, an explored order, an
  expansion count, a memory figure. That is a real regression, and it is exactly what
  this check exists to catch.

The second case is worth taking seriously: `verify:parity` compares the three
implementations to each other, so a change applied to all three at once keeps it green.
The road table lives in three separate encodings, so editing a road *is* a
change to all three. Golden is the only check that notices.

### Fix

Intended change — re-record and review what moves:

```bash
bash scripts/verify_golden.sh --update
git diff tests/golden/
```

`--update` refuses to record unless all three implementations already agree, so it can
never bless output that only one of them produces.

Unintended change — fix the code, not the baseline. Never re-record to make a red check
go green; that discards the only fixed point the project has.

### The trace goldens are a separate set with a separate command

`wasm/tests/golden/` records every frame of the search trace — the frontier and discovered
lists at each expansion — for two routes under both algorithms. It is compared by
`cargo test`, which runs inside `verify:invariants`, **not** by `verify:golden`.

A failure looks like this, and names the frame that moved:

```
arad-bucharest (astar) differs at line 4
```

It catches a change to how `make_step()` sorts or dedupes the frontier: the CLI output is
unaffected, `trace.len()` is unchanged, explored order is unchanged, so every other check
stays green while every middle frame of the animation is different.

Re-record an intended change with a **different** command from the one above:

```bash
UPDATE_GOLDEN=1 cargo test --manifest-path wasm/Cargo.toml
git diff wasm/tests/golden/
```

### Prevent

`npm run verify:golden` for the CLI output and `cargo test` for the trace, both wired into
`npm run verify` and CI.

---

## §4 — `clippy-needless-range-loop`

Rootcause file: [`rootcause/clippy-needless-range-loop.json`](rootcause/clippy-needless-range-loop.json)

### Symptom

`cargo clippy --all-targets -- -D warnings` reports
`clippy::needless-range-loop` in a Rust test.

### Diagnose

Read the named loop. If its numeric index is mainly used to access the same collection,
iterate over that collection directly and keep the index with `.enumerate()`.

### Fix

Replace `for index in 0..items.len()` plus `items[index]` with
`for (index, item) in items.iter().enumerate()`.

### Prevent

`npm run verify:invariants` runs Cargo check, tests, Clippy with warnings denied, and
the formatting check whenever `wasm/Cargo.toml` exists.

---

## §5 — `shared-integration-test-dead-code`

Rootcause file: [`rootcause/shared-integration-test-dead-code.json`](rootcause/shared-integration-test-dead-code.json)

### Symptom

Clippy says a helper in `tests/common/mod.rs` is never used, even though another
integration-test file calls it.

### Diagnose

Remember that each file in `tests/` is a separate crate. A shared module is compiled
once for each test file that declares it, and one of those crates may not use every helper.

### Fix

Prefer smaller shared modules when useful. For a small test-only helper used by most
suites, add a narrow documented `#[allow(dead_code)]` on that helper only.

### Prevent

`npm run verify:invariants` runs Clippy across all targets with warnings denied.

## §6 — `mutation-false-pass-broken-gate`

**Symptom.** `mutation: PASS`, but the run finished in about two minutes instead of ten.
Or a fault whose expectation is `missed` reports *"is now caught -- a gap was closed"*.
Either is the same thing: a gate that cannot run.

**Diagnose.** Read the top of the output. Every gate should be listed green under
*Preflight*. If the suite starts at all, the preflight passed; if it refused with
`the harness is broken`, the named gate is the problem. On a run from before the preflight
existed, look for a gate reporting `CAUGHT` for *every* fault it touches — a working gate
catches some and misses others.

The tell that started this: `node_modules not found ... the vitest faults will be skipped`.
They were not skipped. `gate()` scores detection by exit status alone, so `npx vitest run`
exiting 1 because vitest is not installed reads exactly like vitest failing because the
fault was found.

**Fix.** Whatever the gate needs, install it. For the vitest gates that is `npm ci`; the
script now exits rather than continuing without `node_modules`, and
`.github/workflows/mutation.yml` runs Setup Node and `npm ci` before the suite.

**Prevent.** The suite preflights every gate against the unmutated worktree and refuses to
start if one is red. Adding a gate that needs a tool the CI job does not install now fails
loudly on the first run instead of turning the suite green.

**Never do this.** Do not act on a `missed → caught` promotion without checking the
preflight first. The advice to close a documented blind spot is exactly what a broken gate
produces, and M15 is the blind spot it will offer to close.
