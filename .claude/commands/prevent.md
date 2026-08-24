# /prevent — Run every invariant check and report violations by category

Run these in order and report each as ✅ clean or ❌ with the specific violations. These
are the same scripts CI runs, so a clean run here means a green build.

None of these checks live in this file. The logic is in `scripts/`, called by both this
command and `.github/workflows/ci.yml`, so there is one definition to update.

## Check 1 — Structural invariants I1 and I4

```bash
npm run verify:invariants
```

Covers five things:

- **I1** — exactly one `search()` function. UCS and A\* must stay the same function,
  differing only by the heuristic array passed in.
- **I4** — no `println!`, `eprintln!`, `Instant`, `black_box` or `io::` in engine code.
  Those belong to `bin/cli.rs`; `Instant` panics on `wasm32`.
- **Test inventory** — a fixed list of `#[test]` names must still exist. Deleting a test
  otherwise makes the suite *greener*, so nothing else notices coverage disappearing.
- **Tie-break** — the `Ord` impl in `search.rs` must still order by `f`, then `g`, then
  `city`. Behaviour cannot police this, so the source text is read instead.
- **Builds** — clean Rust, C++, and Python builds, plus `cargo check`, `cargo test`,
  `cargo clippy -- -D warnings`, and `cargo fmt --check`.

**Pass:** `invariants: PASS`
**Fail:** each violation is printed with its file and line. An I1 failure usually means
someone created `search/ucs.rs` and `search/astar.rs` — see `CLAUDE.md`, invariant I1.

*Known non-fatal:* `reference/romania_search.cpp` has one pre-existing unused-`INF`
warning at line 19. It is reported as `warn`, not `FAIL`. Do not fix it as a drive-by.

## Check 2 — Three-language parity (I2)

```bash
npm run verify:parity
```

Builds all three implementations and runs 41 routes through each — every city paired
with the city 7 and 13 positions away, plus `Sibiu -> Sibiu` as a degenerate case —
comparing only deterministic fields: route, explored order, expanded, generated, peak
queue, peak records, memory. Runtimes are discarded because they vary between runs.

**Pass:** `parity: PASS`
**Fail:** a diff is printed per route. This is the most serious failure in the project —
it means the three implementations have drifted, and every number in the report is
suspect until it is resolved. Check the `(f, g, city)` tie-break first.

## Check 3 — Heuristic correctness (I3)

```bash
npm run verify:correctness
```

All 400 start/goal pairs against an independent Dijkstra, plus admissibility
(`h(v) ≤ h*(v)`) on every city and consistency (`h(u) ≤ w(u,v) + h(v)`) on every edge.

**Pass:** `correctness: PASS` with 0/0/0 and `UCS 4200 -> A* 2436 (42.0% reduction)`
**Fail:** an admissibility failure means A\* can return a non-optimal path. Treat it as
a correctness bug, not a tuning issue.

## Check 4 — Golden baseline

```bash
npm run verify:golden
```

Runs three routes through all three implementations and compares the **full CLI output**
against `tests/golden/`, masking only the two runtime columns and the heuristic build
time. Everything else is compared verbatim, column alignment included.

This is the fixed point parity cannot provide. Check 2 compares the three
implementations to *each other*, so a change applied to all three at once stays green —
and since the road table lives in three separate encodings, editing a road is exactly
that shape of change. It is also what makes build step 1's "byte-identical to today's
output" criterion runnable at all.

There is a **second** golden set with a different update command: `wasm/tests/golden/`
records every frame of the search trace and is compared by `cargo test`, inside Check 1.
It catches a change to how `make_step()` sorts or dedupes the frontier — which would
shift every middle frame of the animation while leaving the CLI output untouched.

**Pass:** `golden: PASS`
**Fail:** read the diff before doing anything. An intended change is re-recorded — CLI
output with `bash scripts/verify_golden.sh --update`, the trace with
`UPDATE_GOLDEN=1 cargo test --manifest-path wasm/Cargo.toml`. An unintended number change
is a regression. See `docs/runbook.md` §3 — never re-record to turn a check green.

## Check 5 — Harness wiring

```bash
npm run verify:harness
```

Checks the tooling rather than the engine: that `.claude/settings.json` is valid JSON,
that its PostToolUse hook actually reacts to an edit under `wasm/src/`, that it stays
quiet on unrelated files, and that it never again branches on the nonexistent
`CLAUDE_TOOL_INPUT*` variable. The command under test is read out of `settings.json`, so
this cannot pass against a stale copy while the real hook is dead.

**Pass:** `harness: PASS`
**Fail:** the hook is not wired. See `docs/runbook.md` §2 — note that a hook can resolve
the file path correctly and still be invisible, because on exit 0 its stdout goes to the
debug log rather than to Claude.

## Check 6 — Frontend types and build

```bash
npm run typecheck
npm run build
```

`tsc --noEmit` does not catch what a real build catches — `"use client"` boundary
violations, invalid route segment exports, a server-only import pulled into a client
component. CI runs both for that reason.

**Pass:** no type errors, build completes.

## Check 7 — Manual review, not automated

No script covers these; check them by reading when the relevant files change:

- **I5** — no runtime numbers sourced from the browser. `performance.now()` is coarsened
  to ~100 µs in Chrome against a ~1 µs search. Benchmarks come from `bin/cli.rs`.
- Any new dependency added to the algorithm itself. `wasm-bindgen` and `serde` are for
  the browser boundary only.
- The **C++ and Python** tie-breaks. Swapping to `(f, city, g)` was measured to produce
  identical explored order on all 800 start/goal/algorithm combinations, so parity and
  golden both stay green — no behavioural check can see it. The Rust ordering is now
  pinned by source text in Check 1; the other two encodings are not, and rely on this
  rule being read.

## Check 8 — Do the checks above actually catch anything?

```bash
npm run verify:mutation
```

Not part of `npm run verify` — it takes about ten minutes, because it rebuilds the crate
once per injected fault. It is *configured* weekly in `.github/workflows/mutation.yml` and
has never run on that schedule: scheduled workflows fire only from the default branch, and
`master` has no `.github/`. It also runs on pull requests touching `scripts/`,
`.github/workflows/` or `wasm/src/`, and on demand from the Actions tab.

Injects **14** known bugs into a throwaway worktree and asserts a gate goes red for each.
This is the only check that catches a gate which has quietly stopped working, or one that
was added but never actually caught anything.

**Pass:** `mutation: PASS`
**Fail:** a fault expected to be caught was missed — a gate has stopped working. A fault
expected to be missed that is now caught is reported as an improvement, not a failure;
update its expectation in the script.

*One documented blind spot:* M15, a `getTimelineLength()` that ignores the A\* trace. The
frontend suite has a single fixture, Arad → Bucharest, with UCS 13 and A\* 9 frames, so
`Math.max(ucs, astar)` is always `ucs` and no assertion on this fixture can see it. Closing
it needs a second fixture where A\* runs longer.

*M9 is retired.* It covered `reference/romania_search.rs`, deleted once the team confirmed
the crate is the only Rust engine. Fault ids are not renumbered, so M9 is simply absent.

## Everything at once

```bash
npm run verify
```

## Summary output format

```
## Prevention check results

| Check | Status | Issues |
|-------|--------|--------|
| Invariants (I1, I4, builds) | ✅ / ❌ | N violations |
| Parity (I2) | ✅ / ❌ | N routes differing |
| Correctness (I3) | ✅ / ❌ | N violations |
| Golden baseline | ✅ / ❌ | N routes differing |
| Harness wiring | ✅ / ❌ | N violations |
| Frontend types and build | ✅ / ❌ | N errors |
| Mutation (if run) | ✅ / ❌ | N faults missed |
| Manual review | reviewed / not needed | — |
```

If anything is ❌, fix it before pushing. Use `/diagnose` with the error output to match
it against a known rootcause.
