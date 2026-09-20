# Graph Report - kmitl-romania-map  (2026-09-19)

## Corpus Check
- 141 files · ~930,998 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 17, (none) 6, .graphify-bak 1)

## Summary
- 1093 nodes · 1801 edges · 80 communities (69 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `99a53145`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib.rs
- verify_export.mjs
- romania_search.cpp
- fetch_neighboring_context.mjs
- CLAUDE.md — KMITL Romania Map
- scripts
- Rejected — a Rust HTTP backend
- SearchMap.tsx
- client.ts
- romania_search.py
- What You Must Do When Invoked
- compilerOptions
- trace_golden.rs
- BenchmarkCharts.tsx
- build.rs
- ideas.md
- cli.rs
- package.json
- circuit-flow/page.tsx
- circuitLabelLayout.ts
- verify_golden.sh
- Part C: Current-Flow Heuristic
- verify_mutation.sh
- make_graph
- BenchmarkPanel.test.tsx
- /diagnose — Match an error to a known rootcause, or investigate and record a new one
- /prevent — Run every invariant check and report violations by category
- search
- export_all_runtimes.rs
- devDependencies
- graphify reference: extra exports and benchmark
- CircuitMap.test.tsx
- astar_tests.rs
- Part D: Comparison
- Appendix A: Main Formulas
- 20. Metrics to Measure
- Part A: Uniform-Cost Search
- Runbook
- graphify reference: query, path, explain
- Browser + Rust WebAssembly Architecture
- §3 — golden baseline diffs
- §9 — `search-ui-third-click-no-rolling-restart`
- Sample Search Trace
- CircuitMap.tsx
- Rootcause cache
- §11 — `search-map-zoom-blocks-city-clicks`
- §13 — `terrain-border-mercator-mismatch`
- §14 — `svg-map-note-font-fallback`
- §1 — `empty-cargo-manifest`
- §2 — `dead-posttooluse-hook`
- §4 — `clippy-needless-range-loop`
- §5 — `shared-integration-test-dead-code`
- §7 — `benchmark-panel-static-runtime`
- §8 — `benchmark-ring-null-after-city-change`
- pull_request_template.md
- graphify.js
- dependencies
- verify_env.sh
- verify_harness.sh
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- circuit-flow/loading.tsx
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- opencode.json
- rust_build.sh
- AGENTS.md
- .claude/CLAUDE.md
- post_tool_use.sh
- extraction-spec.md
- romania-search
- BenchmarkPanel.tsx
- CircuitLegend.tsx
- RomaniaSearch.tsx
- PlaybackControls.tsx
- heuristic_tests.rs
- CircuitLegend.test.tsx
- useSearchStore

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `romaniaGraph` - 19 edges
3. `compilerOptions` - 19 edges
4. `useSearchStore` - 18 edges
5. `vitest` - 17 edges
6. `make_graph()` - 17 edges
7. `runSearch()` - 16 edges
8. `search()` - 16 edges
9. `Runbook` - 16 edges
10. `SearchResult` - 15 edges

## Surprising Connections (you probably didn't know these)
- `12 — Calculation page fails static export` --references--> `CalculationPage()`  [INFERRED]
  docs/runbook.md → components/heuristic/CalculationPage.tsx
- `Diagnose` --references--> `inflateOutward()`  [INFERRED]
  docs/runbook.md → scripts/fetch_neighboring_context.mjs
- `Diagnose` --references--> `number()`  [INFERRED]
  docs/runbook.md → app/kirchhoff-matrix/page.tsx
- `Update — the same cause on roads (2026-09-16)` --references--> `SearchTreeLines()`  [INFERRED]
  docs/runbook.md → components/search/SearchMap.tsx
- `Update — the same cause on roads (2026-09-16)` --references--> `ExpandedTreeLines()`  [INFERRED]
  docs/runbook.md → components/search/SearchMap.tsx

## Import Cycles
- None detected.

## Communities (80 total, 11 thin omitted)

### Community 0 - "lib.rs"
Cohesion: 0.06
Nodes (51): city_count, Display, Error, fmt, Formatter, JsValue, prelude, romania_search (+43 more)

### Community 1 - "verify_export.mjs"
Cohesion: 0.05
Nodes (33): ref_node_assert, ref_node_child_process, ref_node_fs, ref_node_url, committed, generated, keys, repo (+25 more)

### Community 2 - "romania_search.cpp"
Cohesion: 0.07
Nodes (42): algorithm, chrono, cmath, cstdint, iomanip, iostream, limits, pair (+34 more)

### Community 3 - "fetch_neighboring_context.mjs"
Cohesion: 0.06
Nodes (54): ALWAYS_VISIBLE_BOUNDS, boundsOverlap(), buildSeaPath(), CANDIDATE_LON_LAT_BOUNDS, centroid(), CLIP_BOUNDS, clipEdge(), clipPolygon() (+46 more)

### Community 4 - "CLAUDE.md — KMITL Romania Map"
Cohesion: 0.06
Nodes (33): Architecture — Rust compiled to WebAssembly, Bug loop protocol — mandatory, in order, every time, Build order, CLAUDE.md — KMITL Romania Map, Common commands, Definition of done, Git and PR workflow, graphify (+25 more)

### Community 5 - "scripts"
Cohesion: 0.09
Nodes (22): scripts, build, build:wasm, dev, doctor, start, test, test:watch (+14 more)

### Community 6 - "Rejected — a Rust HTTP backend"
Cohesion: 0.06
Nodes (30): A* vs UCS: the answer depends on the language, API, Architecture: network dominates everything, Changes the engine would have needed, Chosen — Rust compiled to WebAssembly, Comparison, Constant regardless, Decision (+22 more)

### Community 7 - "SearchMap.tsx"
Cohesion: 0.06
Nodes (61): BASE_MAP_EXTENT, clampMapViewport(), clampMapZoom(), ExpandedTreeLines(), getEffectiveMapExtent(), getMapViewBox(), getTouchDistance(), GraphLine() (+53 more)

### Community 8 - "client.ts"
Cohesion: 0.11
Nodes (34): app_globals, departureMono, metadata, §15 — `heuristic-roundtrip-loses-explained-city`, Diagnose, Fix, Prevent, Symptom (+26 more)

### Community 9 - "romania_search.py"
Cohesion: 0.11
Nodes (21): dataclasses, heapq, math, pathlib, benchmark(), current_flow_heuristic(), explored_text(), main() (+13 more)

### Community 10 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 11 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+13 more)

### Community 12 - "trace_golden.rs"
Cohesion: 0.36
Nodes (9): PathBuf, astar_trace_matches_the_committed_golden(), compare(), golden_path(), render(), ROUTES, SearchResult, String (+1 more)

### Community 13 - "BenchmarkCharts.tsx"
Cohesion: 0.12
Nodes (18): AllPairsResult, AllPairsRuntime, benchmark, BenchmarkCharts(), BenchmarkResults, DivergingRow(), formatCost(), formatMetric() (+10 more)

### Community 14 - "build.rs"
Cohesion: 0.24
Nodes (9): env, fs, CITIES, CITY_COUNT, main(), parse_values(), Vec, validate_city_order() (+1 more)

### Community 15 - "ideas.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Graph Representation, 6. What Is A*?, Appendix B: Short Presentation Explanation, Part B: Custom A* Search, UCS and Custom A* with a Current-Flow Heuristic

### Community 19 - "cli.rs"
Cohesion: 0.24
Nodes (13): black_box, current_flow_heuristic, io, benchmark(), BENCHMARK_RUNS, explored_text(), main(), path_text() (+5 more)

### Community 21 - "package.json"
Cohesion: 0.14
Nodes (13): engines, node, name, private, version, jsdom, react-dom, @testing-library/jest-dom (+5 more)

### Community 22 - "circuit-flow/page.tsx"
Cohesion: 0.06
Nodes (60): app_circuit_flow_calculation_module, abbr(), CircuitFlowPage(), CircuitView(), Edge, findStepIndex(), HeuristicStepsPage(), app_heuristic_steps_page_module (+52 more)

### Community 23 - "circuitLabelLayout.ts"
Cohesion: 0.15
Nodes (18): ANGLE_OFFSETS_DEG, candidatePenalty(), Circle, clamp(), clampCenter(), DEPARTURE_MONO, LabelSpec, layoutLabels() (+10 more)

### Community 24 - "verify_golden.sh"
Cohesion: 0.22
Nodes (11): scripts_lib_rust_build_sh, bad(), mask(), pass(), verify_golden.sh script, bad(), pass(), verify_invariants.sh script (+3 more)

### Community 26 - "Part C: Current-Flow Heuristic"
Cohesion: 0.15
Nodes (13): 10. Effective Resistance, 11. Simple Example, 12. Why the Heuristic Is Admissible, 13. Consistency, 14. Custom A* Pseudocode, 15. Precomputation, 16. Why This Heuristic Is Creative, 17. Possible Weakness (+5 more)

### Community 27 - "verify_mutation.sh"
Cohesion: 0.33
Nodes (11): bad(), begin(), check(), gate(), note(), pass(), preflight(), reset_tree() (+3 more)

### Community 28 - "make_graph"
Cohesion: 0.17
Nodes (17): common, make_graph(), Graph, independent_shortest_costs(), path_cost(), Graph, Option, Vec (+9 more)

### Community 29 - "BenchmarkPanel.test.tsx"
Cohesion: 0.15
Nodes (13): mockedRunSearch, sample, mockedRunSearch, sample, components_search_searchmap_module, public_data_arad_bucharest_search, @testing-library/dom, @testing-library/user-event (+5 more)

### Community 31 - "/diagnose — Match an error to a known rootcause, or investigate and record a new one"
Cohesion: 0.18
Nodes (10): /diagnose — Match an error to a known rootcause, or investigate and record a new one, Invariant-specific hints, Output format for a new bug, Phase A — gather facts from the code, not from the user, Phase B — five whys, autonomously, Phase C — close the loop, Step 1 — Match the signature, Step 2 — Apply the known fix (+2 more)

### Community 32 - "/prevent — Run every invariant check and report violations by category"
Cohesion: 0.18
Nodes (10): Check 1 — Structural invariants I1 and I4, Check 2 — Three-language parity (I2), Check 3 — Heuristic correctness (I3), Check 4 — Golden baseline, Check 5 — Harness wiring, Check 6 — Frontend types and build, Check 7 — Manual review, not automated, Everything at once (+2 more)

### Community 34 - "search"
Cohesion: 0.15
Nodes (17): BinaryHeap, Eq, Ord, Ordering, PartialEq, PartialOrd, SearchStep, Self (+9 more)

### Community 36 - "export_all_runtimes.rs"
Cohesion: 0.24
Nodes (10): current_flow_for_goal, instant, AllRuntimes, main(), PairRuntime, Graph, Vec, timed_median_us() (+2 more)

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 38 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 40 - "CircuitMap.test.tsx"
Cohesion: 0.14
Nodes (9): bounds, consideredEdges, cropIds, edges, hotEdges, markers, ParsedRect, potential (+1 more)

### Community 41 - "astar_tests.rs"
Cohesion: 0.47
Nodes (8): SearchError, current_flow_astar(), current_flow_astar_finds_the_known_optimal_route(), current_flow_astar_is_optimal_for_every_city_pair(), Graph, Result, SearchResult, ucs()

### Community 42 - "Part D: Comparison"
Cohesion: 0.25
Nodes (8): 18. UCS and Custom A* Comparison, 19. Fair Experiment Design, 21. Suggested Test Routes, 22. Expected Results, 23. Result Table, 24. Suggested Hypothesis, 25. Conclusion, Part D: Comparison

### Community 43 - "Appendix A: Main Formulas"
Cohesion: 0.25
Nodes (8): A*, Admissibility, Appendix A: Main Formulas, Current-Flow Heuristic, Custom A* Priority, Road Conductance, UCS, Weighted Kirchhoff Matrix

### Community 46 - "20. Metrics to Measure"
Cohesion: 0.29
Nodes (7): 20.1 Final Path Cost, 20.2 Number of Expanded Nodes, 20.3 Maximum Frontier Size, 20.4 Runtime, 20.5 Memory Usage, 20.6 Heuristic Accuracy, 20. Metrics to Measure

### Community 47 - "Part A: Uniform-Cost Search"
Cohesion: 0.29
Nodes (7): 3. What Is UCS?, 4. How UCS Works, 5. UCS Properties, Advantages, Limitations, Part A: Uniform-Cost Search, UCS Pseudocode

### Community 48 - "Runbook"
Cohesion: 0.29
Nodes (7): §10 — `search-ui-no-clean-slate-reset`, 12 — Calculation page fails static export, §6 — `mutation-false-pass-broken-gate`, Diagnose, Prevent, Runbook, Symptom

### Community 50 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 51 - "Browser + Rust WebAssembly Architecture"
Cohesion: 0.33
Nodes (5): Browser + Rust WebAssembly Architecture, Directory structure, Ownership boundaries, Planned call sequence, Runtime flow

### Community 52 - "§3 — golden baseline diffs"
Cohesion: 0.33
Nodes (6): §3 — golden baseline diffs, Diagnose, Fix, Prevent, Symptom, The trace goldens are a separate set with a separate command

### Community 53 - "§9 — `search-ui-third-click-no-rolling-restart`"
Cohesion: 0.33
Nodes (6): §9 — `search-ui-third-click-no-rolling-restart`, Diagnose, Fix, Prevent, Symptom, step()

### Community 54 - "Sample Search Trace"
Cohesion: 0.33
Nodes (5): Animation Contract, City IDs, Final Result, Rendering Rules, Sample Search Trace

### Community 55 - "CircuitMap.tsx"
Cohesion: 0.21
Nodes (11): adaptiveEdgeGap(), buildResistorSymbol(), CircuitMap(), edgeKey(), EdgeTier, FALLBACK_VIEWBOX, LabelMeta, NODE_SIZE (+3 more)

### Community 56 - "Rootcause cache"
Cohesion: 0.40
Nodes (4): Closing the loop, Format, Naming, Rootcause cache

### Community 57 - "§11 — `search-map-zoom-blocks-city-clicks`"
Cohesion: 0.40
Nodes (5): §11 — `search-map-zoom-blocks-city-clicks`, Diagnose, Fix, Prevent, Symptom

### Community 58 - "§13 — `terrain-border-mercator-mismatch`"
Cohesion: 0.40
Nodes (5): §13 — `terrain-border-mercator-mismatch`, Diagnose, Fix, Prevent, Symptom

### Community 59 - "§14 — `svg-map-note-font-fallback`"
Cohesion: 0.40
Nodes (5): §14 — `svg-map-note-font-fallback`, Diagnose, Fix, Prevent, Symptom

### Community 60 - "§1 — `empty-cargo-manifest`"
Cohesion: 0.40
Nodes (5): §1 — `empty-cargo-manifest`, Diagnose, Fix, Prevent, Symptom

### Community 61 - "§2 — `dead-posttooluse-hook`"
Cohesion: 0.40
Nodes (5): §2 — `dead-posttooluse-hook`, Diagnose, Fix, Prevent, Symptom

### Community 62 - "§4 — `clippy-needless-range-loop`"
Cohesion: 0.40
Nodes (5): §4 — `clippy-needless-range-loop`, Diagnose, Fix, Prevent, Symptom

### Community 63 - "§5 — `shared-integration-test-dead-code`"
Cohesion: 0.40
Nodes (5): §5 — `shared-integration-test-dead-code`, Diagnose, Fix, Prevent, Symptom

### Community 64 - "§7 — `benchmark-panel-static-runtime`"
Cohesion: 0.40
Nodes (5): §7 — `benchmark-panel-static-runtime`, Diagnose, Fix, Prevent, Symptom

### Community 65 - "§8 — `benchmark-ring-null-after-city-change`"
Cohesion: 0.50
Nodes (4): §8 — `benchmark-ring-null-after-city-change`, Diagnose, Fix, Symptom

### Community 66 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checks, If this fixes a bug, Invariants, What this changes

### Community 67 - "graphify.js"
Cohesion: 0.40
Nodes (3): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path

### Community 68 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, next, react, react-dom, zustand

### Community 69 - "verify_env.sh"
Cohesion: 0.90
Nodes (4): bad(), have(), pass(), verify_env.sh script

### Community 70 - "verify_harness.sh"
Cohesion: 0.70
Nodes (4): bad(), pass(), payload(), verify_harness.sh script

### Community 71 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 72 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 73 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 85 - "BenchmarkPanel.tsx"
Cohesion: 0.40
Nodes (3): components_benchmark_benchmarkpanel_module, ResultsStatus, statusLabels

### Community 86 - "CircuitLegend.tsx"
Cohesion: 0.27
Nodes (7): CircuitLegendVariant, OutlineSample, OVERVIEW_OUTLINES, TERMINAL_OUTLINES, components_circuit_circuitmap_module, CircuitMarkerRole, CircuitNode()

### Community 87 - "RomaniaSearch.tsx"
Cohesion: 0.16
Nodes (9): ITEMS, MapLegend(), components_search_maplegend_module, components_search_romaniasearch_module, CitySearch(), components_search_routeplanner_module, normalizeCityName(), RoutePlanner() (+1 more)

### Community 88 - "PlaybackControls.tsx"
Cohesion: 0.25
Nodes (5): Check 8 — Do the checks above actually catch anything?, Frontend tests — the rule, components_search_playbackcontrols_module, PlaybackControls(), getTimelineLength()

### Community 89 - "heuristic_tests.rs"
Cohesion: 0.22
Nodes (6): heuristics, independent_shortest_costs, CITIES, CITY_COUNT, current_flow_table_is_consistent_on_every_road(), EPSILON

### Community 91 - "CircuitLegend.test.tsx"
Cohesion: 0.25
Nodes (7): CircuitLegend(), edges, markers, potential, CircuitMarker, ConductanceEdge, ref_node_path

### Community 93 - "useSearchStore"
Cohesion: 0.36
Nodes (6): BenchmarkPanel(), HeuristicExplainLink(), components_search_heuristicexplainlink_module, RomaniaSearch(), Prevent, useSearchStore

## Knowledge Gaps
- **436 isolated node(s):** `post_tool_use.sh script`, `$schema`, `plugin`, `Edge`, `Edge` (+431 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 564 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `§7 — `benchmark-panel-static-runtime``, `§8 — `benchmark-ring-null-after-city-change``, `CLAUDE.md — KMITL Romania Map`, `client.ts`, `§3 — golden baseline diffs`, `§9 — `search-ui-third-click-no-rolling-restart``, `§11 — `search-map-zoom-blocks-city-clicks``, `§13 — `terrain-border-mercator-mismatch``, `§14 — `svg-map-note-font-fallback``, `§1 — `empty-cargo-manifest``, `§2 — `dead-posttooluse-hook``, `§4 — `clippy-needless-range-loop``, `§5 — `shared-integration-test-dead-code``?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `scripts` connect `scripts` to `package.json`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `§13 — `terrain-border-mercator-mismatch`` connect `§13 — `terrain-border-mercator-mismatch`` to `Runbook`, `SearchMap.tsx`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `post_tool_use.sh script`, `$schema`, `plugin` to the rest of the system?**
  _436 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.06174863387978142 - nodes in this community are weakly interconnected._
- **Should `verify_export.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.052854122621564484 - nodes in this community are weakly interconnected._
- **Should `romania_search.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.06871035940803383 - nodes in this community are weakly interconnected._