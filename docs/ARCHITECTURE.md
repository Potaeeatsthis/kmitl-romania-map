# Browser + Rust WebAssembly Architecture

The project is organized around a browser-only runtime. Next.js statically exports the
interface, Rust compiled to WebAssembly owns both search algorithms and the heuristic
explanation, and Zustand connects a completed search result to the visualizations.

No backend service or HTTP search API is part of this architecture.

## Runtime flow

```text
Browser

        Next.js (static export)
                │
                │ lib/wasm/client.ts — the only module that imports Wasm
                ▼
        Rust WebAssembly
        ┌────────────────────────────────────────────┐
        │  search_pair(start, goal)                   │  lib.rs
        │    search() × 2                             │  search.rs — one function, two heuristics
        │      validate_graph()                       │  graph.rs
        │      validate_heuristic() (h(goal)=0,       │
        │        consistency on every road)           │
        │  explain_current_flow(start, goal)          │  heuristics/current_flow.rs (teaching view)
        └────────────────────────────────────────────┘
                │
                │ embedded at compile time by build.rs
                ▼
        heuristics.json → CURRENT_FLOW_HEURISTICS

                │ JSON
                ▼
        lib/wasm/client.ts validates the payload against lib/types.ts
                │
                ▼
        Zustand (stores/useSearchStore.ts)
                │
                ├──> SearchMap / RoutePlanner / PlaybackControls
                └──> BenchmarkPanel / BenchmarkCharts
```

## Routes

| Route | Renders | Purpose |
|---|---|---|
| `/` | `RomaniaSearch` + `BenchmarkPanel` | Select two cities, animate both searches, compare metrics |
| `/heuristic-summary` | `app/heuristic-summary/page.tsx` | A* decision-by-decision walkthrough for the selected route |
| `/circuit-flow` | `app/circuit-flow/page.tsx` | Roads-as-resistors circuit walkthrough |
| `/kirchhoff-matrix` | `app/kirchhoff-matrix/page.tsx` | Grounded Kirchhoff matrix and conductance rows |
| `/heuristic-steps` | `app/heuristic-steps/page.tsx` | Gauss-Jordan elimination, pivot by pivot |

The four teaching routes share `components/heuristic/CalculationPage.tsx`, which reads the
`start`/`goal` query pair, calls `explainCurrentFlow()`, and wraps the view in a Suspense
boundary (required by static export) plus an error boundary. `lib/heuristicQuery.ts` is the
shared parser so the producer and consumer of those query parameters cannot drift.

## Directory structure

```text
kmitl-romania-map/
├── app/                              Next.js App Router
│   ├── page.tsx                      / — RomaniaSearch + BenchmarkPanel
│   ├── layout.tsx                    self-hosted font and theme-boot script
│   ├── heuristic-summary/            A* decision walkthrough (+ loading.tsx)
│   ├── circuit-flow/                 roads-as-resistors walkthrough (+ loading.tsx)
│   ├── kirchhoff-matrix/             grounded matrix page
│   └── heuristic-steps/              Gauss-Jordan stepper page
├── components/
│   ├── search/                       Shell, animated SVG map, route planner, legend, playback
│   ├── benchmark/                    BenchmarkPanel + BenchmarkCharts
│   ├── heuristic/                    CalculationPage shell, RouteMap, CalculationStepper
│   └── circuit/                      CircuitMap, CircuitMotion, CalculationVisuals, legend
├── lib/                              Browser-side integration and pure helpers
│   ├── wasm/client.ts                The only Wasm boundary; validates every JSON payload
│   ├── types.ts                      Shared TypeScript result types
│   ├── romaniaGraph.ts               20 city positions and all 23 roads (map encoding)
│   ├── roadGeometry.ts               Generated road polylines (gated by verify:frontend-sample)
│   ├── roadPath.ts                   Curved-road geometry helpers
│   ├── countyOutlines.ts             County and border SVG paths
│   ├── neighboringContext.ts         Neighbouring-country backdrop
│   ├── romaniaLandcover.ts           Terrain/satellite landcover overlay
│   ├── kirchhoff.ts                  Grounded-system view model
│   ├── expansionView.ts              Per-expansion candidate derivation
│   ├── circuitLabelLayout.ts         Circuit label placement
│   ├── routeCountyDots.ts            County-clipped route dot texture
│   ├── heuristicQuery.ts             Shared query-param contract
│   ├── traceSelectors.ts             Trace derivation outside React
│   └── basePath.ts                   NEXT_PUBLIC_BASE_PATH normalisation
├── stores/
│   └── useSearchStore.ts             Selection, result, and playback state (Zustand)
├── public/
│   ├── data/                         Committed datasets (see Benchmark data flow)
│   ├── theme-boot.js                 Pre-paint theme script
│   └── wasm/                         wasm-pack output; gitignored, built by build:wasm
├── wasm/                             Rust WebAssembly crate
│   ├── Cargo.toml
│   ├── build.rs                      Validates and embeds data/heuristics.json
│   ├── data/heuristics.json          Precomputed A* heuristic tables
│   ├── src/
│   │   ├── lib.rs                    search_pair / search_pair_json / explain boundary
│   │   ├── graph.rs                  CITIES, make_graph, validate_graph, validate_resistive_graph
│   │   ├── search.rs                 ONE search() — UCS and A* both
│   │   ├── metrics.rs                Counters, trace step, result metrics
│   │   ├── heuristics/current_flow.rs  Embedded lookup and explanation view
│   │   └── bin/                      cli, export_sample, export_all_pairs, export_all_runtimes
│   └── tests/                        Correctness, heuristic, trace-golden, wasm-api, validation
├── reference/                        Standalone Python and C++ comparison implementations
├── scripts/                          The verification harness (npm run verify / CI)
├── tests/golden/                     Recorded CLI output
├── rust-toolchain.toml, .nvmrc, .wasm-pack-version   Pinned toolchains
└── package.json, tsconfig.json
```

`public/wasm/` is generated by `npm run build:wasm` and is intentionally ignored by Git. It is
not source code; the static Next.js build copies it into the exported site.

## Ownership boundaries

- `wasm/` is the only implementation of UCS and A* used by the web app.
- `wasm/src/search.rs` contains one parameterized search implementation. UCS passes an
  all-zero heuristic; A* passes the selected goal table from `heuristics.json`. Queue
  ordering, tie-breaking, tracing, and metrics therefore remain identical between the
  algorithms.
- `search()` runs `validate_graph()` first, which checks only the structural contract every
  consumer needs: exactly `CITY_COUNT` nodes and in-range neighbour indices. Zero and large
  weights are legal for the search. It then validates the heuristic: length, finiteness,
  non-negativity, `h(goal)` exactly zero, and consistency (`h(u) ≤ w(u,v) + h(v)`) within a
  bounded, scale-aware tolerance — `(CITY_COUNT − 1) · ε · scale`, where `scale` is the largest
  weight or heuristic entry, clamped to the largest legitimate simple-path cost. A malformed
  graph or an inconsistent heuristic returns a `SearchError`, never a panic — a panic in Wasm
  would take down the page.
- `best` is an `Option<u32>` array, so `u32::MAX` is a representable path cost rather than an
  ambiguous "unvisited" sentinel. A candidate edge whose cost would overflow `u32` is skipped
  and remembered; the search returns `CostOverflow` only when it exhausts the frontier with an
  overflow seen and no representable route, and `NoRouteExists` otherwise.
- The electrical model (`validate_resistive_graph`) is stricter than the search: it requires a
  simple undirected graph with strictly positive, reciprocal, equal weights in both directions,
  no self-loops, and no duplicate edges. Effective resistance is only defined under those
  conditions, so anything else is rejected up front rather than producing a meaningless value.
- `wasm/data/heuristics.json` belongs to Rust. `wasm/build.rs` validates and embeds it at
  compile time, so the browser makes no second request and the search path never runs
  Gauss-Jordan. The teaching routes are the exception: they call `explainCurrentFlowJson`,
  which runs Gauss-Jordan on demand to show the elimination — never on the search path.
- `lib/wasm/client.ts` is the only TypeScript module that talks directly to WebAssembly. It
  loads the module, calls `searchPairJson`/`explainCurrentFlowJson`, and validates the returned
  JSON against `lib/types.ts` before anything else sees it. React components do not import
  generated Wasm bindings.
- `stores/useSearchStore.ts` owns the selected cities, loading/error state, results, active
  algorithm, playback step, and playback speed. `setCity()` gates the search on two explicit
  picks and rolling-restarts on a third click; `reset()` returns to a blank state. Map and
  metric components consume state; they do not run searches.
- Search results carry the final path, explored order, animation trace, cost, and algorithm
  counters in one `SearchPair` value.

## Benchmark data flow

The browser never runs a benchmark (I5). Three committed datasets feed the panel, in order:

1. `public/data/all-pairs-search.json` — the 400-pair structural dataset (paths, traces,
   counters), written by `wasm/src/bin/export_all_pairs.rs` and checked byte-for-byte by
   `verify:all-pairs`.
2. `public/data/benchmark-results.json` — schema version 2. A deterministic aggregate of (1),
   written by `npm run generate:benchmark` and checked byte-for-byte by `verify:benchmark`. It
   embeds no runtime and no timestamp, so it regenerates exactly.
3. `public/data/all-pairs-runtime.json` — native per-pair timings, written by
   `wasm/src/bin/export_all_runtimes.rs`. Timings are non-reproducible, so
   `verify:all-runtimes` checks structure and coverage (400 pairs, row-major, finite positive
   values), never exact values. These are measured native numbers, not a live browser
   measurement.

`BenchmarkCharts.tsx` imports (2) for the all-pairs summary and the Arad → Bucharest sample,
and looks up the selected pair in (3) by `startCity * city_count + destinationCity`. The live
`SearchResult` from the store supplies expansion counts for the selected route; runtime always
comes from (3).

`peak_payload_bytes` is the search-state payload: it excludes trace, container, and allocator
overhead, and is neither total process memory nor RSS.

## Call sequence

```text
RoutePlanner / SearchMap
    -> Zustand setCity() / run()
    -> lib/wasm/client.ts runSearch(start, goal)
    -> Rust search_pair(start, goal)   (validates graph and heuristic)
    -> SearchPair { ucs, astar }
    -> Zustand
    -> SearchMap + RoutePlanner + BenchmarkCharts
```

The native Rust engine, heuristic table, trace, correctness tests, Wasm boundary, Zustand
search/playback state, map animation, benchmark panel, and the four teaching routes are
implemented. MapLibre and the sidebar remain future work.
