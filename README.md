# Romania Map Search Comparison

This project compares a blind search algorithm with a heuristic search
algorithm on the classic 20-city Romania road map.

- **Blind search:** Uniform-Cost Search (UCS)
- **Heuristic search:** A* with a current-flow effective-resistance heuristic
- **Languages:** Python, C++, and Rust

The detailed project idea and mathematics are available in
[`docs/ideas.md`](docs/ideas.md).

## Current project status

The Rust engine and the standalone Python and C++ reference programs:

- use the same 20 cities, roads, and distances;
- accept a current city and goal city from the user;
- run UCS and current-flow A* for the selected route;
- report the path, explored-node order, distance, runtime, generated nodes,
  and memory-space metrics;
- require no third-party libraries;
- have been compiled and tested successfully; and
- produced matching optimal costs for all 400 possible start/goal pairs.

## Files

| Path | Purpose |
|---|---|
| `app/` | Minimal Next.js App Router entry point |
| `components/`, `stores/`, `lib/` | Frontend placeholders grouped by UI, state, and Wasm integration responsibility |
| `package.json`, `tsconfig.json` | Next.js and TypeScript configuration |
| `public/data/romania.geojson` | Browser-served GeoJSON placeholder |
| `wasm/` | Working Rust engine, native CLI, tests, trace, and precomputed heuristic data |
| `wasm/src/bin/export_sample.rs` | Generates real UCS and A* JSON sample data for the frontend |
| `reference/romania_search.rs` | Transitional native Rust baseline |
| `reference/romania_search.py` | Python 3 reference implementation |
| `reference/romania_search.cpp` | C++17 reference implementation |
| `docs/ideas.md` | Algorithm explanation and mathematical specification |
| `docs/ARCHITECTURE.md` | Runtime flow and ownership boundaries |
| `docs/ARCHITECTURE_DECISION.md` | Why Rust → WebAssembly, and why the alternatives are closed |
| `docs/runbook.md` | Known failures: symptom → diagnose → fix → prevent |
| `scripts/` | The verification harness that `npm run verify` and CI both call |
| `tests/golden/` | Recorded CLI output; `wasm/tests/golden/` records the search trace |
| `.claude/` | The PostToolUse hook and the `/diagnose` and `/prevent` commands |
| `bin/` | Locally compiled executables (ignored by Git) |

## Current process

When one of the programs runs, it follows this process:

1. Display all 20 available cities.
2. Ask for the user's current city.
3. Ask for the user's goal city.
4. Build the current-flow heuristic for that goal city.
5. Run Uniform-Cost Search.
6. Run current-flow A*.
7. Repeat each search 5,000 times to obtain a more stable average runtime.
8. Display both routes and their explored-node order, then compare their
   runtime, expanded nodes, frontier size, and logical memory.
9. Confirm whether both algorithms found the same optimal route cost.

City names are case-insensitive. Multi-word names retain their spaces, such as
`Rimnicu Vilcea`.

## The 20 cities

```text
Arad, Zerind, Oradea, Sibiu, Timisoara, Lugoj, Mehadia, Drobeta,
Craiova, Rimnicu Vilcea, Pitesti, Fagaras, Bucharest, Giurgiu,
Urziceni, Hirsova, Eforie, Vaslui, Iasi, Neamt
```

## How the algorithms work

### Uniform-Cost Search

UCS is the blind-search baseline. It prioritizes the city with the lowest
known travel cost from the starting city:

```text
f(n) = g(n)
```

Because every road distance is non-negative, UCS returns an optimal route.

### Current-flow A*

A* combines the known travel cost with an estimate of the remaining cost:

```text
f(n) = g(n) + h(n)
```

The heuristic treats roads as electrical resistors whose resistance equals the
road distance. It constructs the weighted graph Laplacian, grounds the selected
goal, and inverts the reduced Laplacian using Gauss-Jordan elimination. The
appropriate diagonal value of that inverse is the effective resistance from a
city to the goal.

This grounded-Laplacian calculation is equivalent to the pseudoinverse formula
described in the project specification, but it does not require an external
matrix library.
`wasm/build.rs` validates `wasm/data/heuristics.json` and embeds all twenty goal tables
into the crate at compile time, so the future browser build will never run the matrix
inversion. Today that embedded table is read by the test suite through
`current_flow_for_goal()`; the native CLI still computes the heuristic at runtime with
`current_flow_heuristic()`, and a test asserts the two agree to 1e-8.

## Run the frontend

```bash
npm install
npm run dev
```

## Run the reference programs

### Python

```bash
python3 reference/romania_search.py
```

### C++

Compile with optimization and run:

```bash
mkdir -p bin    # gitignored, so a fresh clone does not have it
g++ -std=c++17 -O2 reference/romania_search.cpp -o bin/romania_search_cpp
./bin/romania_search_cpp
```

### Rust

Run the Cargo CLI:

```bash
cargo run --release --manifest-path wasm/Cargo.toml --bin cli
```

### Export frontend sample data

The `export_sample` binary runs UCS and A* from Arad to Bucharest and writes the
complete paths, animation traces, and metrics as JSON.

Print the JSON:

```bash
cargo run --quiet --manifest-path wasm/Cargo.toml --bin export_sample
```

Save it as frontend sample data:

```bash
cargo run --quiet --manifest-path wasm/Cargo.toml --bin export_sample \
  > public/data/arad-bucharest-search.json
```

The sample is calculated by Rust. The frontend only reads and displays it.

## Verify before pushing

The project's central claim is that three languages produce the same result. These checks
enforce it, and CI runs exactly the same scripts:

```bash
npm run verify              # the five gates below, in order
npm run verify:invariants   # one search(), wasm-safe engine, tie-break, test inventory, builds
npm run verify:parity       # Rust, C++ and Python agree on every deterministic field
npm run verify:correctness  # 400 pairs vs Dijkstra, admissibility, consistency
npm run verify:golden       # full CLI output against tests/golden/
npm run verify:harness      # the PostToolUse hook is wired and reacts
npm run typecheck           # requires `npm install` first
cargo test --manifest-path wasm/Cargo.toml
```

Separately, and not part of `npm run verify` because it takes about ten minutes:

```bash
npm run verify:mutation     # inject ten known bugs; assert a gate goes red for each
```

Project rules, invariants and the build order live in [`CLAUDE.md`](CLAUDE.md). When
something breaks, `/diagnose` matches it against [`docs/runbook.md`](docs/runbook.md).

## Example

```text
Current city: Arad
Goal city: Bucharest

UCS:             Arad -> Sibiu -> Rimnicu Vilcea -> Pitesti -> Bucharest
Current-flow A*: Arad -> Sibiu -> Rimnicu Vilcea -> Pitesti -> Bucharest
Cost: 418 km
```

Exact runtime results vary by language, compiler, computer, and current system
load.

## Comparison metrics

| Metric | Meaning |
|---|---|
| Runtime (us) | Average search time in microseconds over 5,000 runs |
| Expanded | Cities removed from the queue and processed |
| Generated | Priority-queue entries created, including the start |
| Peak queue | Maximum simultaneous entries in the priority queue |
| Peak records | Maximum combined search records being tracked |
| Memory (B) | Estimated language-neutral bytes for stored search fields |

The A* heuristic construction time is reported separately and is excluded from
the average A* search time. Its numeric workspace is also shown separately.

`Memory (B)` is intended to compare the algorithms fairly across the three
languages. It excludes interpreter, allocator, object, and container overhead,
so it is not the total operating-system process memory.

## Complexity

For this graph:

- graph storage is `O(V + E)`;
- UCS search space is `O(V)` plus priority-queue entries;
- A* search space is `O(V)` plus priority-queue entries; and
- current-flow heuristic preprocessing uses `O(V^2)` numeric space and
  `O(V^3)` time for matrix inversion.

With only 20 nodes, both algorithms finish very quickly. Compile C++ and Rust
with optimization and repeat experiments on the same machine for a meaningful
language-speed comparison.
