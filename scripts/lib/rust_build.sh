# Shared by verify_invariants.sh, verify_parity.sh and verify_golden.sh. Sourced, not run.
#
# Build step 1 moves the native reference engine into the wasm Cargo crate and adds a
# native CLI target. Every script that builds Rust must handle both layouts until then.
# Keeping that transition here prevents the verification scripts from drifting.
#
# Usage:  rust_build <workdir> <logfile> <mode>
#   mode = cli     build a runnable CLI, warnings allowed
#   mode = strict  deny warnings, and cover every target once a Cargo project exists
#
# Sets RUST_BIN (path to the runnable binary) and RUST_TOOL (cargo or rustc).
# Returns nonzero on failure, leaving compiler output in <logfile>; the caller decides
# how to report it, because the three scripts report failures differently.

rust_build() {
  local workdir="$1" log="$2" mode="$3"

  if [ -s wasm/Cargo.toml ]; then
    RUST_TOOL="cargo"
    RUST_BIN="$workdir/target/release/cli"
    if [ "$mode" = "strict" ]; then
      RUSTFLAGS="-D warnings" cargo build --release --all-targets \
        --manifest-path wasm/Cargo.toml --target-dir "$workdir/target" 2>"$log" || return 1
    else
      cargo build --release --bin cli \
        --manifest-path wasm/Cargo.toml --target-dir "$workdir/target" 2>"$log" || return 1
    fi
  else
    RUST_TOOL="rustc"
    RUST_BIN="$workdir/rs"
    if [ "$mode" = "strict" ]; then
      rustc --edition=2021 -O -D warnings reference/romania_search.rs -o "$RUST_BIN" 2>"$log" || return 1
    else
      rustc --edition=2021 -O reference/romania_search.rs -o "$RUST_BIN" 2>"$log" || return 1
    fi
  fi

  return 0
}
