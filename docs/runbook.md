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
