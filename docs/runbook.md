# Runbook

One section per known failure, in the same order as the signature table in
`.claude/commands/diagnose.md`. Each section is: **symptom → diagnose → fix → prevent**.

New sections are added by step 2 of the bug loop protocol in `CLAUDE.md`. Do not add a
section for a failure that has not actually occurred.

---

## §1 — `empty-cargo-manifest`

Rootcause file: [`rootcause/empty-cargo-manifest.json`](rootcause/empty-cargo-manifest.json)

### Symptom

Any cargo command run inside `server/` fails immediately:

```
error: failed to parse manifest at `/…/server/Cargo.toml`

Caused by:
  manifest is missing either a `[package]` or a `[workspace]`
```

### Diagnose

```bash
wc -c server/Cargo.toml          # 0 → this is the cause
git ls-files server | while read f; do [ -s "$f" ] || echo "EMPTY: $f"; done
```

Twelve further files under `server/` are also empty. This is expected: the directory
structure was committed before the Cargo project was created.

### Fix

This is the current expected state, not a regression. Build with `rustc`, as the README
documents:

```bash
mkdir -p bin
rustc --edition=2021 -O server/src/main.rs -o bin/romania_search_rust
./bin/romania_search_rust
```

The permanent fix is build step 1 in `CLAUDE.md` — write the manifest and split
`main.rs` into `lib.rs` + `src/bin/cli.rs`. Note that `server/tests/` cannot work until
then either: Rust integration tests may only `use` a **library** crate, and `main.rs` is
a binary, which exports nothing.

### Prevent

Not gateable while it is the expected state — recorded as `automation_gap` in the
rootcause file. CI builds with `rustc` rather than `cargo` for exactly this reason.

Once step 1 lands: add `cargo check`, `cargo test`, `cargo clippy -- -D warnings` and
`cargo fmt --check` to `scripts/verify_invariants.sh`, and this section becomes
historical.

---

## §2 — `dead-posttooluse-hook`

Rootcause file: [`rootcause/dead-posttooluse-hook.json`](rootcause/dead-posttooluse-hook.json)

### Symptom

**There is no error message.** This failure presents as silence: you edit a file under
`server/src/`, and nothing appears — no invariant check, no reminder that I2 needs the
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
reacts to a `server/src/` path, stays quiet on an unrelated one, and that
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

### Prevent

`npm run verify:golden`, wired into `npm run verify` and CI.
