# /prevent — Run every invariant check and report violations by category

Run these in order and report each as ✅ clean or ❌ with the specific violations. These
are the same scripts CI runs, so a clean run here means a green build.

None of these checks live in this file. The logic is in `scripts/`, called by both this
command and `.github/workflows/ci.yml`, so there is one definition to update.

## Check 1 — Structural invariants I1 and I4

```bash
npm run verify:invariants
```

Covers three things:

- **I1** — exactly one `search()` function. UCS and A\* must stay the same function,
  differing only by the heuristic array passed in.
- **I4** — no `println!`, `eprintln!`, `Instant`, `black_box` or `io::` in engine code.
  Those belong to `bin/cli.rs`; `Instant` panics on `wasm32`.
- **Builds** — `rustc -D warnings`, `g++ -Wall -Wextra`, `python3 -m py_compile`.

**Pass:** `invariants: PASS`
**Fail:** each violation is printed with its file and line. An I1 failure usually means
someone created `search/ucs.rs` and `search/astar.rs` — see `CLAUDE.md`, invariant I1.

*Known non-fatal:* `reference/romania_search.cpp` has one pre-existing unused-`INF`
warning at line 19. It is reported as `warn`, not `FAIL`. Do not fix it as a drive-by.

## Check 2 — Three-language parity (I2)

```bash
npm run verify:parity
```

Builds all three implementations and runs six routes through each, comparing only
deterministic fields — route, explored order, expanded, generated, peak queue, peak
records, memory. Runtimes are discarded because they vary between runs.

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

## Check 4 — Frontend types

```bash
npm run typecheck
```

**Pass:** no output, exit 0.

## Check 5 — Manual review, not automated

No script covers these; check them by reading when the relevant files change:

- **I5** — no runtime numbers sourced from the browser. `performance.now()` is coarsened
  to ~100 µs in Chrome against a ~1 µs search. Benchmarks come from `bin/cli.rs`.
- Any new dependency added to the algorithm itself. `wasm-bindgen` and `serde` are for
  the browser boundary only.

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
| Frontend types | ✅ / ❌ | N errors |
| Manual review | reviewed / not needed | — |
```

If anything is ❌, fix it before pushing. Use `/diagnose` with the error output to match
it against a known rootcause.
