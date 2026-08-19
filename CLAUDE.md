# CLAUDE.md — KMITL Romania Map

Read automatically at the start of every session. Single source of truth for project
context, architecture rules, and workflow. Five people have write access, so
treat everything here as binding rather than advisory.

---

## What this project is

A comparison of two search algorithms on the classic 20-city Romania road map:

- **Uniform-Cost Search** — the blind-search baseline, `f(n) = g(n)`
- **Current-flow A\*** — `f(n) = g(n) + h(n)`, where `h` is the effective resistance
  from a city to the goal, treating each road as a resistor whose resistance equals
  its distance in km

The graph has 20 cities and 23 undirected roads. The finished product is an interactive
web page that animates both searches side by side and reports their metrics.

---

## What exists, and what does not

**Do not assume the web application exists. Do not rewrite the engine — it is verified.**

| Part | State |
|---|---|
| `reference/romania_search.rs` | **Working.** 319 lines: engine + terminal UI + benchmark harness |
| `reference/romania_search.py` | **Working.** 238 lines, matches Rust exactly |
| `reference/romania_search.cpp` | **Working.** 304 lines, matches Rust exactly |
| `docs/ideas.md`, `docs/ARCHITECTURE.md` | **Written.** Algorithm maths and architecture analysis |
| `wasm/Cargo.toml` | **Empty (0 bytes).** No cargo command works yet |
| `wasm/src/*.rs`, `wasm/src/heuristics/`, `wasm/tests/` | **Empty (0 bytes).** Rust/Wasm placeholders only |
| `components/`, `lib/`, `stores/` | **Empty.** Each file holds only its own path as a comment |
| `public/data/romania.geojson` | **Empty (0 bytes)** |
| `app/page.tsx` | Renders the words "KMITL Romania Map" and nothing else |

Verified across all 400 start/goal pairs: 0 cost mismatches against an independent
Dijkstra, 0 admissibility violations, 0 consistency violations, and UCS 4200 → A\* 2436
expansions (42.0% reduction). All three languages produce byte-identical explored order
and counters.

---

## Architecture — Option C, Rust compiled to WebAssembly

**Locked. Do not reopen this. The `wasm/` crate runs in the browser; do not add an HTTP backend.**

The engine stays in Rust and compiles two ways: a native binary for the terminal and
benchmarks, and a `.wasm` module that runs inside the visitor's browser. Hosting is
static files on GitHub Pages.

```
                 wasm/src/lib.rs
                 (graph · search · heuristic · trace)
                        /            \
              cargo build          wasm-pack build
                    /                    \
          src/bin/cli.rs            romania_search.wasm
       terminal UI, benchmarks       runs in the browser
                    \                    /
                     next build --export
                            |
                      GitHub Pages
```

**Why not the alternatives**, recorded so they stay closed:

- **Option A — port the algorithm to TypeScript.** Rejected: the algorithm would exist
  twice and drift, and drift silently invalidates the comparison the project is about.
- **Option B — Rust HTTP backend.** Rejected: the requirement is to deploy once when
  finished and leave it. A server is not deployed once, it is kept running — it needs
  uptime, a renewed TLS certificate, and ~$6/month, and the project goes offline when
  funding stops. It is also *slower*: 30–200 ms of network for 0.4 µs of work. Its one
  real advantage — computing the 20 goal heuristics once instead of per visitor — is
  taken away by precomputing them at build time under Option C.

Option B becomes correct only if a live deployed service is itself required, or if the
graph is ever scaled to the real Romanian road network (the heuristic is `O(V³)` time
and `O(V²)` memory; browser-side precompute stops being viable well before that).

---

## Build order

Six steps. Each has a check that must pass before the next begins.

1. **Make `wasm/` a real Cargo project.** Fill `Cargo.toml`; move the engine from
   `reference/romania_search.rs` into `lib.rs`, `graph.rs`, the single `search.rs`,
   `heuristics/current_flow.rs`, and `src/bin/cli.rs`; convert
   `panic!("No route exists…")` to a `Result`; delete unused placeholders.
   → *check:* `cargo run --bin cli` output byte-identical to today's.
2. **Record the trace.** A frontier snapshot per expansion, inside `search()`.
   → *check:* trace length equals `expanded` (13 UCS, 9 A\* on Arad→Bucharest).
3. **Fill `wasm/tests/`.** Port `scripts/verify_correctness.py` to `cargo test`.
   → *check:* `cargo test` green.
4. **Cross to WebAssembly.** `wasm-bindgen` wrapper plus build-time heuristic tables.
   → *check:* wasm results match the native CLI on all 400 pairs.
5. **Frontend.** SVG schematic graph first — no dependencies, works everywhere. Then the
   Zustand store, controls, and charts. MapLibre last, as an enhancement.
   → *check:* animation reaches the final path; counters match the CLI.
6. **Deploy.** One GitHub Actions workflow: wasm-pack → `next build` → Pages.
   → *check:* the live URL works in a fresh browser.

Target layout after step 4:

```
wasm/
├── Cargo.toml                    [package] [lib] [[bin]]
├── data/
│   └── heuristics.json           precomputed A* tables
├── src/
│   ├── lib.rs                    modules + wasm-bindgen boundary
│   ├── graph.rs                  CITIES, Graph, make_graph
│   ├── search.rs                 ONE search() — UCS and A* both
│   ├── metrics.rs                counters and result metrics
│   ├── heuristics/
│   │   ├── mod.rs
│   │   └── current_flow.rs       heuristic lookup and validation
│   └── bin/
│       ├── cli.rs                stdin UI, native benchmarks
│       └── export.rs             writes heuristic/benchmark data
└── tests/
```

---

## Invariants — violating these is a review failure

| # | Rule | Why |
|---|---|---|
| **I1** | `search()` is **one** function. UCS and A\* differ only by the heuristic array passed in | Identical allocations and tie-breaks are *why* the comparison measures the heuristic rather than two different programs. Two implementations drift, and drift silently invalidates every reported number |
| **I2** | Rust, C++ and Python produce **identical** explored order, expanded, generated, peak queue, peak records and memory | The project's central claim |
| **I3** | The heuristic stays admissible (`h(v) ≤ h*(v)`) and consistent (`h(u) ≤ w(u,v) + h(v)`) | A\* returns optimal paths only while this holds |
| **I4** | Engine code uses no `std::io`, `std::time`, `println!`, `eprintln!` or `black_box` — those belong to `bin/cli.rs` | `Instant` panics on `wasm32`, so a leak breaks the browser build at runtime rather than at compile time |
| **I5** | Runtime numbers come from native runs only, never from a browser | Chrome coarsens `performance.now()` to ~100 µs as a Spectre mitigation, against a ~1 µs search. Report expansion counts — they are exact integers, identical on every machine |

**Do not reintroduce `wasm/src/search/ucs.rs` or `wasm/src/search/astar.rs`.**
They violate I1. Keep one `wasm/src/search.rs`.

`npm run verify` checks I1–I4. I5 is a convention.

---

## Key decisions (locked)

- Architecture: Option C, Rust → WebAssembly, static hosting
- Priority-queue tie-break: `(f, g, city)` ascending, **identical in all three languages**.
  Keep it that way deliberately, because the automated gate cannot police it: swapping the
  secondary keys to `(f, city, g)` was measured to produce identical explored order on all
  800 start/goal/algorithm combinations, so no route sample detects the change. Parity
  catches drift in *outcomes*; a tie-break edit that yields identical outcomes passes
- The algorithm itself stays dependency-free; `wasm-bindgen` and `serde` are for the
  browser boundary only, never for the search or the heuristic
- Heuristic tables are precomputed at build time and shipped as JSON; the browser never
  runs Gauss-Jordan
- Benchmarks are produced natively by `wasm/src/bin/cli.rs`, committed as `benchmarks.json`
- The SVG schematic graph is the primary view; MapLibre is an optional enhancement layered
  on a project that already works
- `search()` returns `Result`, never `panic!`, once step 1 lands — a panic in wasm takes
  down the whole page

---

## Bug loop protocol — mandatory, in order, every time

When a bug is found, complete all four steps before reporting it fixed:

1. **Rootcause** — run `/diagnose` first to match against known patterns. Only if there is
   no match, write `docs/rootcause/<slug>.json` *before* applying the fix.
2. **Runbook** — add or update the section in `docs/runbook.md`: symptom → diagnose → fix
   → prevent.
3. **Command** — add a row to the signature table in `.claude/commands/diagnose.md`. If the
   prevention is new, add a check to `.claude/commands/prevent.md`.
4. **Harness** — decide whether the bug can be caught automatically. If yes, add it to
   `scripts/verify_*.sh` so both `/prevent` and CI pick it up. If no, fill
   `automation_gap` in the rootcause JSON explaining why.

> **The harness does not update itself.** Steps 1–3 are Claude's responsibility. Step 4 is
> a code change Claude makes. CI only ever runs what is already configured.

---

## Definition of done

1. `npm run verify` exits 0 — invariants, parity, and correctness all pass
2. `npm run typecheck` exits 0
3. No invariant I1–I5 broken
4. For a bug fix: the loop above is closed, all four steps
5. No pre-existing check newly broken

---

## Common commands

```bash
npm run verify              # all three gates — run this before pushing
npm run verify:invariants   # I1, I4, clean builds
npm run verify:parity       # I2 — three languages agree
npm run verify:correctness  # I3 — 400 pairs, admissibility, consistency
npm run typecheck           # tsc --noEmit

# Run the three implementations (they prompt for two city names)
mkdir -p bin
rustc --edition=2021 -O reference/romania_search.rs -o bin/romania_search_rust && ./bin/romania_search_rust
g++ -std=c++17 -O2 reference/romania_search.cpp -o bin/romania_search_cpp && ./bin/romania_search_cpp
python3 reference/romania_search.py
```

After step 1 lands, add `cargo test`, `cargo clippy -- -D warnings` and
`cargo fmt --check`, and extend `scripts/verify_invariants.sh` to call them.

---

## Known gotchas

- **`cargo` does not work.** `wasm/Cargo.toml` is 0 bytes; every cargo command fails with
  `manifest is missing either a [package] or a [workspace]`. Build with `rustc` until step 1.
- **`python3 reference/romania_search.py` fails if the working directory has moved.** Shell
  state can persist between commands; use an absolute path or `cd` to the repo root first.
- **`bin/` must exist** before `rustc -o bin/…` or `g++ -o bin/…` — it is gitignored, so a
  fresh clone does not have it. `mkdir -p bin` first.
- **`wasm32-unknown-unknown` and `wasm-pack` are not installed.** Needed from step 4:
  `rustup target add wasm32-unknown-unknown` and `cargo install wasm-pack`.
- **`std::time::Instant` panics on `wasm32`.** This is what I4 exists to prevent. Keeping
  `benchmark()` in `bin/cli.rs` solves it automatically.
- **`reference/romania_search.cpp` has one pre-existing `-Wall -Wextra` warning** — an unused
  `INF` constant at line 19. Reported by `verify:invariants`, deliberately non-fatal; do not
  "fix" it as a drive-by change.
- **Benchmark output varies run to run** by up to 1.5× from CPU frequency ramp-up. Never
  quote a single run; expansion counts are the reliable comparison.

---

## Git and PR workflow

- Remote is `Potaeeatsthis/kmitl-romania-map`; default branch `master`, work happens on `dev`
  and feature branches
- Branch names: `feat/step<N>-<name>`, e.g. `feat/step1-wasm-crate`
- Conventional commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`
- One PR per build step; CI must be green before merge
- **Claude does not commit or push unless explicitly told to**
- The step-1 restructure moves the engine from `reference/romania_search.rs` into `wasm/`,
  so it must be one person in one PR,
  **merged before anyone else starts Rust work**. Rust work and frontend work touch disjoint
  files and can run in parallel; two people inside `wasm/src/` at the same time cannot
- Repository settings need admin, which only `Potaeeatsthis` has. Two are required and are
  not yet enabled: branch protection on `master` requiring the `correctness` and `frontend`
  checks, and Settings → Pages → Source: GitHub Actions (needed by build step 6)
