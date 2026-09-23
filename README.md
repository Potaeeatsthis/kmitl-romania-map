# Romania Map Search Comparison

This project compares a blind search algorithm with a heuristic search
algorithm on the classic 20-city Romania road map.

- **Blind search:** Uniform-Cost Search (UCS)
- **Heuristic search:** A* with a current-flow effective-resistance heuristic
- **Languages:** Python, C++, and Rust

**Live demo:** <https://potaeeatsthis.github.io/kmitl-romania-map/>

The detailed project idea and mathematics are available in
[`docs/ideas.md`](docs/ideas.md).

## Current project status

The web application is built and deployed. It runs the Rust engine as WebAssembly in the
browser, animates UCS and current-flow A* over the map for any of the 400 start/goal pairs,
and reports the benchmark comparison. Four further pages walk through how the heuristic is
calculated.

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
| `app/` | Next.js App Router routes: the search page plus the four heuristic teaching pages |
| `components/`, `stores/`, `lib/` | Working frontend grouped by responsibility: search UI, benchmark panel, heuristic calculation pages, and the Wasm/state integration they share |
| `package.json`, `tsconfig.json`, `.nvmrc`, `rust-toolchain.toml`, `.wasm-pack-version` | Next.js/TypeScript configuration and the pinned Node, Rust, and wasm-pack versions |
| `wasm/` | Working Rust engine, native CLI, tests, trace, and precomputed heuristic data |
| `wasm/src/bin/export_sample.rs` | Generates real UCS and A* JSON sample data for the frontend |
| `wasm/src/bin/export_all_pairs.rs` | Generates the 400-pair structural dataset the benchmark aggregate is derived from |
| `wasm/src/bin/export_all_runtimes.rs` | Times both algorithms for all 400 pairs natively |
| `components/benchmark/` | Displays the UCS and A* benchmark comparison |
| `public/data/benchmark-results.json` | Deterministic aggregate generated from `all-pairs-search.json`; no runtime numbers |
| `public/data/all-pairs-runtime.json` | Native per-pair timings; non-reproducible, checked for structure and coverage only |
| `reference/romania_search.py` | Python 3 reference implementation |
| `reference/romania_search.cpp` | C++17 reference implementation |
| `docs/ideas.md` | Algorithm explanation and mathematical specification |
| `docs/ARCHITECTURE.md` | Runtime flow and ownership boundaries |
| `docs/ARCHITECTURE_DECISION.md` | Why Rust → WebAssembly, and why the alternatives are closed |
| `docs/runbook.md` | Known failures: symptom → diagnose → fix → prevent |
| `docs/rootcause/` | One JSON record per diagnosed bug |
| `docs/sample-trace.md` | The recorded Arad → Bucharest search trace |
| `.github/workflows/` | `ci.yml` (the required checks), `deploy.yml` (GitHub Pages), `mutation.yml` (weekly harness audit) |
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
into the crate at compile time, so the search path never runs the matrix inversion — the
browser and the test suite both read the table through `current_flow_for_goal()`. The native
CLI still computes the heuristic at runtime with `current_flow_heuristic()`, and a test
asserts the two agree to 1e-8. The optional heuristic-explanation pages are the exception:
they call `explainCurrentFlow()` on demand to walk through Gauss-Jordan elimination for
teaching, and never on the search path.

## Set up the project

Node and wasm-pack are pinned. Install the toolchains below, then let `npm run doctor`
confirm them — it reports whether a machine has everything `npm run verify:all` and
`npm run build` need, and prints the install command for whatever is missing.

1. **Node 24** (`.nvmrc`, `engines.node >= 24`). Install nvm from
   <https://github.com/nvm-sh/nvm#installing-and-updating>, or use any Node 24 from your
   package manager, then:

   ```bash
   nvm install        # reads .nvmrc; `nvm use` when it is already installed
   ```

2. **Rust 1.95.0**, pinned by `rust-toolchain.toml` together with `rustfmt`, `clippy`, and the
   `wasm32-unknown-unknown` target. Install rustup from <https://rustup.rs>, then let it read
   the pin:

   ```bash
   rustup show        # installs the pinned toolchain; `rustup target add wasm32-unknown-unknown` if the target is missing
   ```

3. **wasm-pack 0.15.0**, pinned in `.wasm-pack-version`. Download the prebuilt release for your
   platform from <https://github.com/rustwasm/wasm-pack/releases/tag/v0.15.0> and put the
   binary on `PATH`. Do **not** use `cargo install wasm-pack` (compiles from source) or the
   generic `init.sh` installer (takes the latest version and defeats the pin); `doctor` fails
   on a version mismatch, not just on absence.

4. **Project dependencies**:

   ```bash
   npm ci             # reproducible install from package-lock.json
   npm run doctor     # preflight: Node, cargo/rustc, g++, python3, wasm32, wasm-pack, node_modules
   ```

`doctor` reads the Node floor from `engines` in `package.json` (`>=24`), so an older Node
fails the preflight rather than reporting `ok`. `npm run verify:frontend` and CI both run
`tests/verify_env.test.sh`, the regression check for that gate.

## Run the frontend

```bash
npm run dev        # builds the Wasm bundle, then starts Next.js
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

Generate the complete precomputed dataset for all 400 ordered city pairs,
including routes where the start and destination are the same:

```bash
cargo run --quiet --manifest-path wasm/Cargo.toml --bin export_all_pairs \
  > public/data/all-pairs-search.json
```

This writes `public/data/all-pairs-search.json`. Pairs are stored in row-major
order, so the entry for `start` and `goal` is at `start * 20 + goal`.

### Regenerate the benchmark data

The benchmark panel does not read `all-pairs-search.json` directly — it is multi-megabyte and
carries every animation trace. A small deterministic aggregate is derived from it instead:

```bash
npm run generate:benchmark   # writes public/data/benchmark-results.json from all-pairs-search.json
npm run verify:benchmark     # byte-for-byte check that the committed aggregate is current
```

`benchmark-results.json` is schema version 2. It contains only expansion counts and the
sample-route metrics, embeds no runtime and no timestamp, and therefore regenerates
byte-for-byte. Native per-pair timings ship separately in `public/data/all-pairs-runtime.json`,
written by redirecting `wasm/src/bin/export_all_runtimes.rs`. Those timings are measured on one
machine at one time and are deliberately not part of the deterministic aggregate.

## Verify before pushing

The project's central claim is that three languages produce the same result. These checks
enforce it, and CI runs exactly the same scripts:

```bash
npm run verify                  # all nine engine/data gates below, in order
npm run verify:invariants       # one search(), wasm-safe engine, tie-break, test inventory, builds
npm run verify:parity           # Rust, C++ and Python agree on every deterministic field
npm run verify:correctness      # 400 pairs vs Dijkstra, admissibility, consistency
npm run verify:golden           # full CLI output against tests/golden/
npm run verify:harness          # the PostToolUse hook and the CI workflows are wired and react
npm run verify:frontend-sample  # Rust JSON and the road table match the frontend contract
npm run verify:all-pairs        # the committed 400-pair dataset matches a fresh Rust export
npm run verify:all-runtimes     # per-pair timings: structure and coverage, not exact values
npm run verify:benchmark        # benchmark-results.json is a fresh deterministic aggregate
npm run verify:frontend         # env regression + tsc --noEmit + vitest (the other half of verify:all)
cargo test --manifest-path wasm/Cargo.toml
```

`npm run verify:all` is `npm run verify` plus `npm run verify:frontend`, and is what CI
requires.

Separately, and not part of `npm run verify` because it takes about ten minutes:

```bash
npm run verify:mutation     # inject 14 known bugs; assert a gate goes red for each
```

Project rules, invariants and the build order live in [`CLAUDE.md`](CLAUDE.md). When
something breaks, `/diagnose` matches it against [`docs/runbook.md`](docs/runbook.md).

## Deploy

`.github/workflows/deploy.yml` publishes to GitHub Pages: it triggers when CI completes for a
push to `master`, checks out the exact revision CI verified, builds the Wasm bundle and the
static export, and publishes. There is no manual dispatch — redeploy by re-running CI on
`master`.

The Pages base path has exactly one source, `NEXT_PUBLIC_BASE_PATH`, set only by that
workflow from the repository name. After `npm run build`, `npm run verify:export` checks the
static export is servable under that prefix.

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
| Runtime (us) | Native only: the CLI reports the mean of 5,000 searches per launch; the benchmark data reports the median of 1,000 runs per pair |
| Expanded | Cities removed from the queue and processed |
| Generated | Priority-queue entries created, including the start |
| Peak queue | Maximum simultaneous entries in the priority queue |
| Peak records | Maximum combined search records being tracked |
| Search-state payload (B) | Language-neutral bytes the search keeps in its own state |

The A* heuristic construction time is reported separately and is excluded from
the search time. Its numeric workspace is also shown separately.

`Search-state payload` is intended to compare the algorithms fairly across the
three languages. It is a language-neutral count of stored fields: it excludes the
trace, container, object, and allocator overhead, and it is neither the total
operating-system process memory nor RSS. The benchmark panel labels this metric
exactly that way.

Native runtime is not reproducible — it varies run to run and machine to machine.
`public/data/all-pairs-runtime.json` is a measured sample, not a current guarantee, and
`verify:all-runtimes` deliberately checks only its structure and coverage. The committed
sample records neither the machine nor the source revision it was measured at, so treat it as
a historical measurement rather than a property of the current build. Expansion counts are
exact integers and are the reliable comparison.

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
