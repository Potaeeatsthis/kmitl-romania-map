# Graph Report - kmitl-romania-map  (2026-09-22)

## Corpus Check
- 151 files · ~944,284 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 18, (none) 6, .woff2 1)

## Summary
- 1200 nodes · 2045 edges · 91 communities (78 shown, 13 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 108 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b7e4aa60`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lib.rs
- verify_export.mjs
- romania_search.cpp
- fetch_neighboring_context.mjs
- Romania Map Search Comparison
- scripts
- Rejected — a Rust HTTP backend
- CircuitMap.tsx
- client.ts
- circuit-flow/page.tsx
- What You Must Do When Invoked
- compilerOptions
- trace_golden.rs
- BenchmarkCharts.tsx
- SearchMap.tsx
- ideas.md
- make_graph
- heuristic-steps/page.tsx
- ref_node_fs
- cli.rs
- search
- package.json
- heuristic-summary/page.tsx
- circuitLabelLayout.ts
- verify_golden.sh
- romania_search.py
- Part C: Current-Flow Heuristic
- verify_mutation.sh
- make_graph
- BenchmarkPanel.test.tsx
- heuristic_tests.rs
- /diagnose — Match an error to a known rootcause, or investigate and record a new one
- /prevent — Run every invariant check and report violations by category
- CLAUDE.md — KMITL Romania Map
- QueueEntry
- §13 — `terrain-border-mercator-mismatch`
- types.ts
- devDependencies
- graphify reference: extra exports and benchmark
- verify_all_pairs.mjs
- CircuitMap.test.tsx
- current_flow.rs
- Part D: Comparison
- Appendix A: Main Formulas
- verify_frontend_sample.mjs
- CalculationPages.test.tsx
- 20. Metrics to Measure
- Part A: Uniform-Cost Search
- §10 — `search-ui-no-clean-slate-reset`
- verify_env.test.sh
- graphify reference: query, path, explain
- runSearch
- §3 — golden baseline diffs
- §9 — `search-ui-third-click-no-rolling-restart`
- Sample Search Trace
- graph.rs
- Rootcause cache
- §11 — `search-map-zoom-blocks-city-clicks`
- useSearchStore
- §14 — `svg-map-note-font-fallback`
- §1 — `empty-cargo-manifest`
- §2 — `dead-posttooluse-hook`
- §4 — `clippy-needless-range-loop`
- §5 — `shared-integration-test-dead-code`
- §7 — `benchmark-panel-static-runtime`
- astar_tests.rs
- pull_request_template.md
- graphify.js
- Runbook
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
- README.md
- dependencies
- RomaniaSearch.tsx
- SearchMap
- §16 — `mobile-route-panel-covers-clear-button`
- heuristic-summary/loading.tsx

## God Nodes (most connected - your core abstractions)
1. `make_graph()` - 30 edges
2. `scripts` - 24 edges
3. `search()` - 24 edges
4. `romaniaGraph` - 20 edges
5. `vitest` - 20 edges
6. `compilerOptions` - 19 edges
7. `useSearchStore` - 18 edges
8. `Runbook` - 17 edges
9. `CircuitMap()` - 16 edges
10. `runSearch()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `12 — Calculation page fails static export` --references--> `CalculationPage()`  [INFERRED]
  docs/runbook.md → components/heuristic/CalculationPage.tsx
- `Current-flow A*` --references--> `explainCurrentFlow()`  [INFERRED]
  README.md → lib/wasm/client.ts
- `Diagnose` --references--> `inflateOutward()`  [INFERRED]
  docs/runbook.md → scripts/fetch_neighboring_context.mjs
- `Diagnose` --references--> `number()`  [INFERRED]
  docs/runbook.md → app/kirchhoff-matrix/page.tsx
- `Fix` --references--> `RomaniaSearch()`  [INFERRED]
  docs/runbook.md → components/search/RomaniaSearch.tsx

## Import Cycles
- None detected.

## Communities (91 total, 13 thin omitted)

### Community 0 - "lib.rs"
Cohesion: 0.06
Nodes (46): city_count, Display, Error, fmt, Formatter, heapq, JsValue, pathlib (+38 more)

### Community 1 - "verify_export.mjs"
Cohesion: 0.12
Nodes (12): collectCss(), cssRoot, html, indexSize, localCssRefs, missingCssRefs, refs, repo (+4 more)

### Community 2 - "romania_search.cpp"
Cohesion: 0.07
Nodes (42): algorithm, chrono, cmath, cstdint, iomanip, iostream, limits, pair (+34 more)

### Community 3 - "fetch_neighboring_context.mjs"
Cohesion: 0.06
Nodes (54): ALWAYS_VISIBLE_BOUNDS, boundsOverlap(), buildSeaPath(), CANDIDATE_LON_LAT_BOUNDS, centroid(), CLIP_BOUNDS, clipEdge(), clipPolygon() (+46 more)

### Community 4 - "Romania Map Search Comparison"
Cohesion: 0.10
Nodes (20): C++, Comparison metrics, Complexity, Current-flow A*, Current process, Current project status, Example, Export frontend sample data (+12 more)

### Community 5 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, build, build:wasm, dev, doctor, generate:benchmark, start, test (+16 more)

### Community 6 - "Rejected — a Rust HTTP backend"
Cohesion: 0.06
Nodes (30): A* vs UCS: the answer depends on the language, API, Architecture: network dominates everything, Changes the engine would have needed, Chosen — Rust compiled to WebAssembly, Comparison, Constant regardless, Decision (+22 more)

### Community 7 - "CircuitMap.tsx"
Cohesion: 0.05
Nodes (63): CircuitLegend(), CircuitLegendVariant, OutlineSample, OVERVIEW_OUTLINES, TERMINAL_OUTLINES, edges, markers, potential (+55 more)

### Community 8 - "client.ts"
Cohesion: 0.12
Nodes (32): app_globals, departureMono, metadata, basePath, normalizeBasePath(), assertHeuristicExplanation(), assertSearchResponse(), isCityIndex() (+24 more)

### Community 9 - "circuit-flow/page.tsx"
Cohesion: 0.20
Nodes (14): app_circuit_flow_calculation_module, abbr(), CircuitView(), Edge, findStepIndex(), SummaryView(), CandidateBarChart(), CircuitSchematic() (+6 more)

### Community 10 - "What You Must Do When Invoked"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 11 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+13 more)

### Community 12 - "trace_golden.rs"
Cohesion: 0.16
Nodes (18): env, fs, PathBuf, CITIES, CITY_COUNT, main(), parse_values(), Vec (+10 more)

### Community 13 - "BenchmarkCharts.tsx"
Cohesion: 0.12
Nodes (18): AllPairsResult, AllPairsRuntime, benchmark, BenchmarkCharts(), BenchmarkResults, DivergingRow(), formatCost(), formatMetric() (+10 more)

### Community 14 - "SearchMap.tsx"
Cohesion: 0.08
Nodes (26): BASE_MAP_EXTENT, clampMapViewport(), clampMapZoom(), ExpandedTreeLines(), getEffectiveMapExtent(), getMapViewBox(), getTouchDistance(), GraphLine() (+18 more)

### Community 15 - "ideas.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Graph Representation, 6. What Is A*?, Appendix B: Short Presentation Explanation, Part B: Custom A* Search, UCS and Custom A* with a Current-Flow Heuristic

### Community 16 - "make_graph"
Cohesion: 0.19
Nodes (19): explain_current_flow, make_graph(), current_flow_rejects_a_directed_graph(), current_flow_rejects_a_duplicate_edge(), current_flow_rejects_a_mismatched_reverse_weight(), current_flow_rejects_a_self_loop(), current_flow_rejects_invalid_start_and_goal(), current_flow_reports_a_disconnected_resistive_graph() (+11 more)

### Community 17 - "heuristic-steps/page.tsx"
Cohesion: 0.21
Nodes (13): HeuristicStepsPage(), app_heuristic_steps_page_module, StepsView(), KirchhoffView(), name(), number(), CalculationPage(), buildGroundedKirchhoffSystem() (+5 more)

### Community 18 - "ref_node_fs"
Cohesion: 0.16
Nodes (15): ref_node_fs, ref_node_url, allPairs, output, algorithmResults(), ALGORITHMS, buildBenchmarkResults(), LABELS (+7 more)

### Community 19 - "cli.rs"
Cohesion: 0.12
Nodes (23): black_box, current_flow_for_goal, current_flow_heuristic, instant, io, benchmark(), BENCHMARK_RUNS, explored_text() (+15 more)

### Community 20 - "search"
Cohesion: 0.31
Nodes (10): CONSISTENCY_SCALE_EDGES, MAX_LEGITIMATE_PATH_COST, reconstruct_path(), Graph, Result, SearchResult, Vec, search() (+2 more)

### Community 21 - "package.json"
Cohesion: 0.17
Nodes (11): engines, node, name, private, version, jsdom, react-dom, @types/node (+3 more)

### Community 22 - "heuristic-summary/page.tsx"
Cohesion: 0.17
Nodes (15): Edge, HeuristicSummaryPage(), CalculationContent(), ExplanationBoundary, Props, CalculationStage, CalculationStepper(), components_heuristic_calculationstepper_module (+7 more)

### Community 23 - "circuitLabelLayout.ts"
Cohesion: 0.15
Nodes (18): ANGLE_OFFSETS_DEG, candidatePenalty(), Circle, clamp(), clampCenter(), DEPARTURE_MONO, LabelSpec, layoutLabels() (+10 more)

### Community 24 - "verify_golden.sh"
Cohesion: 0.22
Nodes (11): scripts_lib_rust_build_sh, bad(), mask(), pass(), verify_golden.sh script, bad(), pass(), verify_invariants.sh script (+3 more)

### Community 25 - "romania_search.py"
Cohesion: 0.19
Nodes (14): dataclasses, math, benchmark(), current_flow_heuristic(), explored_text(), main(), path_text(), search() (+6 more)

### Community 26 - "Part C: Current-Flow Heuristic"
Cohesion: 0.15
Nodes (13): 10. Effective Resistance, 11. Simple Example, 12. Why the Heuristic Is Admissible, 13. Consistency, 14. Custom A* Pseudocode, 15. Precomputation, 16. Why This Heuristic Is Creative, 17. Possible Weakness (+5 more)

### Community 27 - "verify_mutation.sh"
Cohesion: 0.33
Nodes (11): bad(), begin(), check(), gate(), note(), pass(), preflight(), reset_tree() (+3 more)

### Community 28 - "make_graph"
Cohesion: 0.31
Nodes (9): common, invalid_inputs_return_errors_instead_of_panicking(), Graph, Result, SearchResult, trace_records_one_complete_frame_per_expansion(), ucs(), ucs_finds_the_known_optimal_route() (+1 more)

### Community 29 - "BenchmarkPanel.test.tsx"
Cohesion: 0.12
Nodes (16): components_benchmark_benchmarkpanel_module, ResultsStatus, statusLabels, mockedRunSearch, sample, mockedRunSearch, sample, components_search_searchmap_module (+8 more)

### Community 30 - "heuristic_tests.rs"
Cohesion: 0.18
Nodes (10): heuristics, independent_shortest_costs, independent_shortest_costs(), path_cost(), Graph, Option, Vec, current_flow_table_is_admissible_and_zero_at_every_goal() (+2 more)

### Community 31 - "/diagnose — Match an error to a known rootcause, or investigate and record a new one"
Cohesion: 0.18
Nodes (10): /diagnose — Match an error to a known rootcause, or investigate and record a new one, Invariant-specific hints, Output format for a new bug, Phase A — gather facts from the code, not from the user, Phase B — five whys, autonomously, Phase C — close the loop, Step 1 — Match the signature, Step 2 — Apply the known fix (+2 more)

### Community 32 - "/prevent — Run every invariant check and report violations by category"
Cohesion: 0.18
Nodes (10): Check 1 — Structural invariants I1 and I4, Check 2 — Three-language parity (I2), Check 3 — Heuristic correctness (I3), Check 4 — Golden baseline, Check 5 — Harness wiring, Check 6 — Frontend types and build, Check 7 — Manual review, not automated, Everything at once (+2 more)

### Community 33 - "CLAUDE.md — KMITL Romania Map"
Cohesion: 0.15
Nodes (13): Architecture — Rust compiled to WebAssembly, Bug loop protocol — mandatory, in order, every time, Build order, CLAUDE.md — KMITL Romania Map, Common commands, Definition of done, Git and PR workflow, Invariants — violating these is a review failure (+5 more)

### Community 34 - "QueueEntry"
Cohesion: 0.21
Nodes (11): BinaryHeap, Eq, Ord, Ordering, PartialEq, PartialOrd, SearchStep, Self (+3 more)

### Community 35 - "§13 — `terrain-border-mercator-mismatch`"
Cohesion: 0.40
Nodes (5): §13 — `terrain-border-mercator-mismatch`, Diagnose, Fix, Prevent, Symptom

### Community 36 - "types.ts"
Cohesion: 0.33
Nodes (7): buildExpansionView(), edgeKey(), ExpansionCandidate, ExpansionView, EliminationStep, FrontierNode, SearchStep

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 38 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 39 - "verify_all_pairs.mjs"
Cohesion: 0.18
Nodes (9): ref_node_assert, ref_node_child_process, committed, generated, keys, repo, committed, generated (+1 more)

### Community 40 - "CircuitMap.test.tsx"
Cohesion: 0.07
Nodes (23): bounds, consideredEdges, cropIds, edges, hotEdges, markers, ParsedRect, potential (+15 more)

### Community 41 - "current_flow.rs"
Cohesion: 0.27
Nodes (13): ConductanceEdge, current_flow_for_goal(), current_flow_heuristic(), EliminationStep, explain_current_flow(), HeuristicError, HeuristicExplanation, HeuristicResult (+5 more)

### Community 42 - "Part D: Comparison"
Cohesion: 0.25
Nodes (8): 18. UCS and Custom A* Comparison, 19. Fair Experiment Design, 21. Suggested Test Routes, 22. Expected Results, 23. Result Table, 24. Suggested Hypothesis, 25. Conclusion, Part D: Comparison

### Community 43 - "Appendix A: Main Formulas"
Cohesion: 0.25
Nodes (8): A*, Admissibility, Appendix A: Main Formulas, Current-Flow Heuristic, Custom A* Priority, Road Conductance, UCS, Weighted Kirchhoff Matrix

### Community 44 - "verify_frontend_sample.mjs"
Cohesion: 0.15
Nodes (10): cityPositions, engine, geoKeyMatches, geoSource, graphRoadMatches, graphTsSource, repo, resultKeys (+2 more)

### Community 45 - "CalculationPages.test.tsx"
Cohesion: 0.22
Nodes (7): CircuitFlowPage(), KirchhoffMatrixPage(), branching, branchingSearch, circuit, goalRemoved, navigation

### Community 46 - "20. Metrics to Measure"
Cohesion: 0.29
Nodes (7): 20.1 Final Path Cost, 20.2 Number of Expanded Nodes, 20.3 Maximum Frontier Size, 20.4 Runtime, 20.5 Memory Usage, 20.6 Heuristic Accuracy, 20. Metrics to Measure

### Community 47 - "Part A: Uniform-Cost Search"
Cohesion: 0.29
Nodes (7): 3. What Is UCS?, 4. How UCS Works, 5. UCS Properties, Advantages, Limitations, Part A: Uniform-Cost Search, UCS Pseudocode

### Community 48 - "§10 — `search-ui-no-clean-slate-reset`"
Cohesion: 0.50
Nodes (4): §10 — `search-ui-no-clean-slate-reset`, Diagnose, Prevent, Symptom

### Community 49 - "verify_env.test.sh"
Cohesion: 0.47
Nodes (8): assert_line(), bad(), copy_doctor(), expect(), node_line(), pass(), verify_env.test.sh script, strip_ansi()

### Community 50 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 51 - "runSearch"
Cohesion: 0.29
Nodes (8): §15 — `heuristic-roundtrip-loses-explained-city`, Diagnose, Fix, Prevent, Symptom, loadWasm(), publicUrl(), runSearch()

### Community 52 - "§3 — golden baseline diffs"
Cohesion: 0.33
Nodes (6): §3 — golden baseline diffs, Diagnose, Fix, Prevent, Symptom, The trace goldens are a separate set with a separate command

### Community 53 - "§9 — `search-ui-third-click-no-rolling-restart`"
Cohesion: 0.33
Nodes (6): §9 — `search-ui-third-click-no-rolling-restart`, Diagnose, Fix, Prevent, Symptom, step()

### Community 54 - "Sample Search Trace"
Cohesion: 0.33
Nodes (5): Animation Contract, City IDs, Final Result, Rendering Rules, Sample Search Trace

### Community 55 - "graph.rs"
Cohesion: 0.43
Nodes (7): CITIES, CITY_COUNT, GraphError, Graph, Result, validate_graph(), validate_resistive_graph()

### Community 56 - "Rootcause cache"
Cohesion: 0.40
Nodes (4): Closing the loop, Format, Naming, Rootcause cache

### Community 57 - "§11 — `search-map-zoom-blocks-city-clicks`"
Cohesion: 0.40
Nodes (5): §11 — `search-map-zoom-blocks-city-clicks`, Diagnose, Fix, Prevent, Symptom

### Community 58 - "useSearchStore"
Cohesion: 0.16
Nodes (13): BenchmarkPanel(), HeuristicExplainLink(), components_search_heuristicexplainlink_module, RomaniaSearch(), Benchmark data flow, Browser + Rust WebAssembly Architecture, Call sequence, Directory structure (+5 more)

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

### Community 65 - "astar_tests.rs"
Cohesion: 0.54
Nodes (7): current_flow_astar(), current_flow_astar_finds_the_known_optimal_route(), current_flow_astar_is_optimal_for_every_city_pair(), Graph, Result, SearchResult, ucs()

### Community 66 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checks, If this fixes a bug, Invariants, What this changes

### Community 67 - "graphify.js"
Cohesion: 0.40
Nodes (3): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path

### Community 68 - "Runbook"
Cohesion: 0.29
Nodes (7): 12 — Calculation page fails static export, §6 — `mutation-false-pass-broken-gate`, §8 — `benchmark-ring-null-after-city-change`, Diagnose, Fix, Runbook, Symptom

### Community 69 - "verify_env.sh"
Cohesion: 0.87
Nodes (5): bad(), check_node(), have(), pass(), verify_env.sh script

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

### Community 86 - "dependencies"
Cohesion: 0.40
Nodes (5): dependencies, next, react, react-dom, zustand

### Community 87 - "RomaniaSearch.tsx"
Cohesion: 0.15
Nodes (11): ITEMS, MapLegend(), components_search_maplegend_module, components_search_romaniasearch_module, CitySearch(), components_search_routeplanner_module, normalizeCityName(), PlannerMode (+3 more)

### Community 88 - "SearchMap"
Cohesion: 0.19
Nodes (13): Check 8 — Do the checks above actually catch anything?, Frontend tests — the rule, components_search_playbackcontrols_module, PlaybackControls(), SearchMap(), getExpandedCities(), getExpandedPathPrefix(), getFinalPath() (+5 more)

### Community 89 - "§16 — `mobile-route-panel-covers-clear-button`"
Cohesion: 0.50
Nodes (4): §16 — `mobile-route-panel-covers-clear-button`, Diagnose, Prevent, Symptom

## Knowledge Gaps
- **459 isolated node(s):** `post_tool_use.sh script`, `$schema`, `plugin`, `Edge`, `Edge` (+454 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 598 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `§16 — `mobile-route-panel-covers-clear-button``, `§7 — `benchmark-panel-static-runtime``, `§13 — `terrain-border-mercator-mismatch``, `§10 — `search-ui-no-clean-slate-reset``, `runSearch`, `§3 — golden baseline diffs`, `README.md`, `§9 — `search-ui-third-click-no-rolling-restart``, `§11 — `search-map-zoom-blocks-city-clicks``, `§14 — `svg-map-note-font-fallback``, `§1 — `empty-cargo-manifest``, `§2 — `dead-posttooluse-hook``, `§4 — `clippy-needless-range-loop``, `§5 — `shared-integration-test-dead-code``?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Why does `§13 — `terrain-border-mercator-mismatch`` connect `§13 — `terrain-border-mercator-mismatch`` to `Runbook`, `SearchMap.tsx`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `vitest` connect `CircuitMap.test.tsx` to `types.ts`, `CircuitMap.tsx`, `client.ts`, `CalculationPages.test.tsx`, `heuristic-steps/page.tsx`, `package.json`, `heuristic-summary/page.tsx`, `circuitLabelLayout.ts`, `SearchMap`, `BenchmarkPanel.test.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 28 inferred relationships involving `make_graph()` (e.g. with `main()` and `main()`) actually correct?**
  _`make_graph()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `search()` (e.g. with `benchmark()` and `timed_median_us()`) actually correct?**
  _`search()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `post_tool_use.sh script`, `$schema`, `plugin` to the rest of the system?**
  _459 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.05844155844155844 - nodes in this community are weakly interconnected._