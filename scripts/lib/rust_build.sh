# Shared by verify_invariants.sh, verify_parity.sh and verify_golden.sh. Sourced, not run.
#
# Build step 1 moved the engine into the wasm Cargo crate, and reference/romania_search.rs
# has since been retired, so there is one layout and one build. The rustc fallback that
# used to live here compiled that file; it was unreachable from the day the crate landed.
#
# Usage:  rust_build <workdir> <logfile> <mode>
#   mode = cli     build a runnable CLI, warnings allowed
#   mode = strict  deny warnings, and cover every target
#
# Sets RUST_BIN (path to the runnable binary) and RUST_TOOL (always "cargo"; kept because
# the three callers print it, and printing the tool is still useful in a failure message).
# Returns nonzero on failure, leaving compiler output in <logfile>; the caller decides
# how to report it, because the three scripts report failures differently.

rust_build() {
  local workdir="$1" log="$2" mode="$3"

  # CI sets CARGO_TARGET_DIR so every script shares one cached directory instead of
  # compiling the crate from scratch four times per run. Unset locally, so each script
  # keeps using its own throwaway directory and nothing is left behind.
  local target_dir="${CARGO_TARGET_DIR:-$workdir/target}"

  RUST_TOOL="cargo"
  RUST_BIN="$target_dir/release/cli"

  if [ "$mode" = "strict" ]; then
    RUSTFLAGS="-D warnings" cargo build --release --all-targets \
      --manifest-path wasm/Cargo.toml --target-dir "$target_dir" 2>"$log" || return 1
  else
    cargo build --release --bin cli \
      --manifest-path wasm/Cargo.toml --target-dir "$target_dir" 2>"$log" || return 1
  fi

  return 0
}
