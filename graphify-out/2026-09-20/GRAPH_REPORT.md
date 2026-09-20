# Graph Report - kmitl-romania-map  (2026-09-20)

## Corpus Check
- 145 files · ~937,275 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .css 18, (none) 6, .graphify-bak 1)

## Summary
- 1134 nodes · 1905 edges · 87 communities (74 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.87)
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
- CircuitMap.tsx
- client.ts
- romania_search.py
- What You Must Do When Invoked
- compilerOptions
- trace_golden.rs
- BenchmarkCharts.tsx
- SearchMap.tsx
- ideas.md
- heuristic-summary/page.tsx
- circuit-flow/page.tsx
- next
- cli.rs
- search
- package.json
- CalculationPages.test.tsx
- circuitLabelLayout.ts
- verify_golden.sh
- metrics.rs
- Part C: Current-Flow Heuristic
- verify_mutation.sh
- make_graph
- types.ts
- independent_shortest_costs
- /diagnose — Match an error to a known rootcause, or investigate and record a new one
- /prevent — Run every invariant check and report violations by category
- CircuitMotion.tsx
- QueueEntry
- §13 — `terrain-border-mercator-mismatch`
- export_all_runtimes.rs
- devDependencies
- graphify reference: extra exports and benchmark
- expansionView.ts
- CircuitMap.test.tsx
- astar_tests.rs
- Part D: Comparison
- Appendix A: Main Formulas
- client.test.ts
- §15 — `heuristic-roundtrip-loses-explained-city`
- 20. Metrics to Measure
- Part A: Uniform-Cost Search
- §10 — `search-ui-no-clean-slate-reset`
- heuristic-summary/loading.tsx
- graphify reference: query, path, explain
- Browser + Rust WebAssembly Architecture
- §3 — golden baseline diffs
- §9 — `search-ui-third-click-no-rolling-restart`
- Sample Search Trace
- ExplanationBoundary
- Rootcause cache
- §11 — `search-map-zoom-blocks-city-clicks`
- §14 — `svg-map-note-font-fallback`
- §1 — `empty-cargo-manifest`
- §2 — `dead-posttooluse-hook`
- §4 — `clippy-needless-range-loop`
- §5 — `shared-integration-test-dead-code`
- §7 — `benchmark-panel-static-runtime`
- Runbook
- pull_request_template.md
- graphify.js
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
- useSearchStore
- SearchMap
- vitest
- BenchmarkPanel.tsx

## God Nodes (most connected - your core abstractions)
1. `scripts` - 22 edges
2. `romaniaGraph` - 20 edges
3. `vitest` - 20 edges
4. `compilerOptions` - 19 edges
5. `useSearchStore` - 18 edges
6. `make_graph()` - 17 edges
7. `CircuitMap()` - 16 edges
8. `runSearch()` - 16 edges
9. `search()` - 16 edges
10. `Runbook` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Check 8 — Do the checks above actually catch anything?` --references--> `getTimelineLength()`  [INFERRED]
  .claude/commands/prevent.md → lib/traceSelectors.ts
- `Diagnose` --references--> `runSearch()`  [INFERRED]
  docs/runbook.md → lib/wasm/client.ts
- `Fix` --references--> `runSearch()`  [INFERRED]
  docs/runbook.md → lib/wasm/client.ts
- `Diagnose` --references--> `inflateOutward()`  [INFERRED]
  docs/runbook.md → scripts/fetch_neighboring_context.mjs
- `Diagnose` --references--> `number()`  [INFERRED]
  docs/runbook.md → app/kirchhoff-matrix/page.tsx

## Import Cycles
- None detected.

## Communities (87 total, 13 thin omitted)

### Community 0 - "lib.rs"
Cohesion: 0.06
Nodes (50): city_count, Display, Error, fmt, Formatter, heuristics, independent_shortest_costs, JsValue (+42 more)

### Community 1 - "verify_export.mjs"
Cohesion: 0.05
Nodes (34): ref_node_assert, ref_node_child_process, ref_node_fs, ref_node_path, ref_node_url, committed, generated, keys (+26 more)

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

### Community 7 - "CircuitMap.tsx"
Cohesion: 0.05
Nodes (60): CircuitLegend(), CircuitLegendVariant, OutlineSample, OVERVIEW_OUTLINES, TERMINAL_OUTLINES, edges, markers, potential (+52 more)

### Community 8 - "client.ts"
Cohesion: 0.31
Nodes (19): assertHeuristicExplanation(), assertSearchResponse(), isCityIndex(), isCityIndexArray(), isConductanceEdge(), isDiscoveredNode(), isEliminationStep(), isFiniteNumber() (+11 more)

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
Cohesion: 0.16
Nodes (18): env, fs, PathBuf, CITIES, CITY_COUNT, main(), parse_values(), Vec (+10 more)

### Community 13 - "BenchmarkCharts.tsx"
Cohesion: 0.12
Nodes (17): AllPairsResult, AllPairsRuntime, benchmark, BenchmarkCharts(), BenchmarkResults, DivergingRow(), formatCost(), formatMetric() (+9 more)

### Community 14 - "SearchMap.tsx"
Cohesion: 0.10
Nodes (22): BASE_MAP_EXTENT, clampMapViewport(), clampMapZoom(), ExpandedTreeLines(), GraphLine(), INITIAL_MAP_VIEWPORT, labelOffsets, MapExtent (+14 more)

### Community 15 - "ideas.md"
Cohesion: 0.29
Nodes (6): 1. Project Overview, 2. Graph Representation, 6. What Is A*?, Appendix B: Short Presentation Explanation, Part B: Custom A* Search, UCS and Custom A* with a Current-Flow Heuristic

### Community 16 - "heuristic-summary/page.tsx"
Cohesion: 0.17
Nodes (17): Edge, HeuristicSummaryPage(), SummaryView(), CalculationContent(), Props, CalculationStage, CalculationStepper(), components_heuristic_calculationstepper_module (+9 more)

### Community 17 - "circuit-flow/page.tsx"
Cohesion: 0.22
Nodes (13): app_circuit_flow_calculation_module, abbr(), CircuitView(), Edge, findStepIndex(), CandidateBarChart(), CircuitSchematic(), KclBalanceScale() (+5 more)

### Community 18 - "next"
Cohesion: 0.21
Nodes (8): app_globals, departureMono, metadata, basePath, normalizeBasePath(), basePath, nextConfig, next

### Community 19 - "cli.rs"
Cohesion: 0.24
Nodes (13): black_box, current_flow_heuristic, io, benchmark(), BENCHMARK_RUNS, explored_text(), main(), path_text() (+5 more)

### Community 20 - "search"
Cohesion: 0.25
Nodes (10): BinaryHeap, SearchStep, update_peaks(), make_step(), reconstruct_path(), Graph, Result, SearchResult (+2 more)

### Community 21 - "package.json"
Cohesion: 0.12
Nodes (16): dependencies, next, react, react-dom, zustand, engines, node, name (+8 more)

### Community 22 - "CalculationPages.test.tsx"
Cohesion: 0.13
Nodes (20): CircuitFlowPage(), HeuristicStepsPage(), app_heuristic_steps_page_module, StepsView(), KirchhoffMatrixPage(), KirchhoffView(), name(), number() (+12 more)

### Community 23 - "circuitLabelLayout.ts"
Cohesion: 0.14
Nodes (19): ANGLE_OFFSETS_DEG, candidatePenalty(), Circle, clamp(), clampCenter(), DEPARTURE_MONO, LabelSpec, layoutLabels() (+11 more)

### Community 24 - "verify_golden.sh"
Cohesion: 0.22
Nodes (11): scripts_lib_rust_build_sh, bad(), mask(), pass(), verify_golden.sh script, bad(), pass(), verify_invariants.sh script (+3 more)

### Community 25 - "metrics.rs"
Cohesion: 0.48
Nodes (6): DiscoveredNode, FrontierNode, Option, Vec, SearchResult, SearchStep

### Community 26 - "Part C: Current-Flow Heuristic"
Cohesion: 0.15
Nodes (13): 10. Effective Resistance, 11. Simple Example, 12. Why the Heuristic Is Admissible, 13. Consistency, 14. Custom A* Pseudocode, 15. Precomputation, 16. Why This Heuristic Is Creative, 17. Possible Weakness (+5 more)

### Community 27 - "verify_mutation.sh"
Cohesion: 0.33
Nodes (11): bad(), begin(), check(), gate(), note(), pass(), preflight(), reset_tree() (+3 more)

### Community 28 - "make_graph"
Cohesion: 0.26
Nodes (12): common, make_graph(), Graph, current_flow_table_is_admissible_and_zero_at_every_goal(), invalid_inputs_return_errors_instead_of_panicking(), Graph, Result, SearchResult (+4 more)

### Community 29 - "types.ts"
Cohesion: 0.12
Nodes (16): mockedRunSearch, sample, mockedRunSearch, sample, components_search_searchmap_module, DiscoveredNode, EliminationStep, FrontierNode (+8 more)

### Community 30 - "independent_shortest_costs"
Cohesion: 0.47
Nodes (5): independent_shortest_costs(), path_cost(), Graph, Option, Vec

### Community 31 - "/diagnose — Match an error to a known rootcause, or investigate and record a new one"
Cohesion: 0.18
Nodes (10): /diagnose — Match an error to a known rootcause, or investigate and record a new one, Invariant-specific hints, Output format for a new bug, Phase A — gather facts from the code, not from the user, Phase B — five whys, autonomously, Phase C — close the loop, Step 1 — Match the signature, Step 2 — Apply the known fix (+2 more)

### Community 32 - "/prevent — Run every invariant check and report violations by category"
Cohesion: 0.17
Nodes (11): Check 1 — Structural invariants I1 and I4, Check 2 — Three-language parity (I2), Check 3 — Heuristic correctness (I3), Check 4 — Golden baseline, Check 5 — Harness wiring, Check 6 — Frontend types and build, Check 7 — Manual review, not automated, Check 8 — Do the checks above actually catch anything? (+3 more)

### Community 33 - "CircuitMotion.tsx"
Cohesion: 0.27
Nodes (10): CircuitMotion, CircuitMotionContext, CircuitMotionControl(), CircuitMotionProvider(), getReducedMotion(), components_circuit_circuitmotion_module, subscribeToReducedMotion(), PlayingProbe() (+2 more)

### Community 34 - "QueueEntry"
Cohesion: 0.25
Nodes (8): Eq, Ord, Ordering, PartialEq, PartialOrd, Self, QueueEntry, Option

### Community 35 - "§13 — `terrain-border-mercator-mismatch`"
Cohesion: 0.40
Nodes (5): §13 — `terrain-border-mercator-mismatch`, Diagnose, Fix, Prevent, Symptom

### Community 36 - "export_all_runtimes.rs"
Cohesion: 0.24
Nodes (10): current_flow_for_goal, instant, AllRuntimes, main(), PairRuntime, Graph, Vec, timed_median_us() (+2 more)

### Community 37 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @testing-library/dom, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 38 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 39 - "expansionView.ts"
Cohesion: 0.48
Nodes (5): buildExpansionView(), edgeKey(), ExpansionCandidate, ExpansionView, SearchStep

### Community 40 - "CircuitMap.test.tsx"
Cohesion: 0.11
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

### Community 44 - "client.test.ts"
Cohesion: 0.43
Nodes (6): parseHeuristicExplanation(), parseSearchResponse(), engineExplanation(), identityLaplacian(), inverseAugmented(), parse()

### Community 45 - "§15 — `heuristic-roundtrip-loses-explained-city`"
Cohesion: 0.40
Nodes (5): §15 — `heuristic-roundtrip-loses-explained-city`, Diagnose, Fix, Prevent, Symptom

### Community 46 - "20. Metrics to Measure"
Cohesion: 0.29
Nodes (7): 20.1 Final Path Cost, 20.2 Number of Expanded Nodes, 20.3 Maximum Frontier Size, 20.4 Runtime, 20.5 Memory Usage, 20.6 Heuristic Accuracy, 20. Metrics to Measure

### Community 47 - "Part A: Uniform-Cost Search"
Cohesion: 0.29
Nodes (7): 3. What Is UCS?, 4. How UCS Works, 5. UCS Properties, Advantages, Limitations, Part A: Uniform-Cost Search, UCS Pseudocode

### Community 48 - "§10 — `search-ui-no-clean-slate-reset`"
Cohesion: 0.50
Nodes (4): §10 — `search-ui-no-clean-slate-reset`, Diagnose, Prevent, Symptom

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

### Community 56 - "Rootcause cache"
Cohesion: 0.40
Nodes (4): Closing the loop, Format, Naming, Rootcause cache

### Community 57 - "§11 — `search-map-zoom-blocks-city-clicks`"
Cohesion: 0.40
Nodes (5): §11 — `search-map-zoom-blocks-city-clicks`, Diagnose, Fix, Prevent, Symptom

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

### Community 65 - "Runbook"
Cohesion: 0.33
Nodes (6): §6 — `mutation-false-pass-broken-gate`, §8 — `benchmark-ring-null-after-city-change`, Diagnose, Fix, Runbook, Symptom

### Community 66 - "pull_request_template.md"
Cohesion: 0.40
Nodes (4): Checks, If this fixes a bug, Invariants, What this changes

### Community 67 - "graphify.js"
Cohesion: 0.40
Nodes (3): IMPORTANT: keep the reminder string free of backticks and $(...) constructs., ref_fs, ref_path

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

### Community 87 - "useSearchStore"
Cohesion: 0.12
Nodes (14): ITEMS, MapLegend(), components_search_maplegend_module, components_search_playbackcontrols_module, PlaybackControls(), components_search_romaniasearch_module, RomaniaSearch(), CitySearch() (+6 more)

### Community 88 - "SearchMap"
Cohesion: 0.23
Nodes (14): Frontend tests — the rule, getEffectiveMapExtent(), getMapViewBox(), getTouchDistance(), roadLabelPosition(), SearchMap(), getExpandedCities(), getExpandedPathPrefix() (+6 more)

### Community 91 - "vitest"
Cohesion: 0.22
Nodes (5): installMatchMedia(), @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 93 - "BenchmarkPanel.tsx"
Cohesion: 0.20
Nodes (7): BenchmarkPanel(), components_benchmark_benchmarkpanel_module, ResultsStatus, statusLabels, HeuristicExplainLink(), components_search_heuristicexplainlink_module, Prevent

## Knowledge Gaps
- **441 isolated node(s):** `post_tool_use.sh script`, `$schema`, `plugin`, `Edge`, `Edge` (+436 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 581 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `§7 — `benchmark-panel-static-runtime``, `§13 — `terrain-border-mercator-mismatch``, `CLAUDE.md — KMITL Romania Map`, `§15 — `heuristic-roundtrip-loses-explained-city``, `§10 — `search-ui-no-clean-slate-reset``, `§3 — golden baseline diffs`, `§9 — `search-ui-third-click-no-rolling-restart``, `CalculationPages.test.tsx`, `§11 — `search-map-zoom-blocks-city-clicks``, `§14 — `svg-map-note-font-fallback``, `§1 — `empty-cargo-manifest``, `§2 — `dead-posttooluse-hook``, `§4 — `clippy-needless-range-loop``, `§5 — `shared-integration-test-dead-code``?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `§13 — `terrain-border-mercator-mismatch`` connect `§13 — `terrain-border-mercator-mismatch`` to `Runbook`, `SearchMap.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `CircuitMap.tsx`, `CircuitMap.test.tsx`, `expansionView.ts`, `client.test.ts`, `heuristic-summary/page.tsx`, `package.json`, `CalculationPages.test.tsx`, `circuitLabelLayout.ts`, `SearchMap`, `types.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `post_tool_use.sh script`, `$schema`, `plugin` to the rest of the system?**
  _441 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lib.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.0597567424643046 - nodes in this community are weakly interconnected._
- **Should `verify_export.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.051515151515151514 - nodes in this community are weakly interconnected._
- **Should `romania_search.cpp` be split into smaller, more focused modules?**
  _Cohesion score 0.06871035940803383 - nodes in this community are weakly interconnected._