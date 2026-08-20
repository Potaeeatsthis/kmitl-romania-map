# Web Application Architecture

**Decided: the engine is Rust compiled to WebAssembly, served as static files.**
That decision is locked in `CLAUDE.md`. This document is the record of how it was
reached — the measurements, and why the two alternatives are closed. It is not a menu.

Three architectures were considered for **where the search actually runs**: in the
browser as TypeScript, on a server as Rust, or in the browser as Rust compiled to
WebAssembly. The algorithm itself is unchanged in all three.

The engine now lives in `wasm/src/`, with `reference/romania_search.cpp` and
`reference/romania_search.py` kept as the parity implementations.

---

## Measured baseline

Arad → Bucharest, on the existing code. C++ built with `g++ -O2`, Rust with
`rustc -O`. Medians across repeated process launches — **not** single runs, for
reasons given in "Measurement warnings" below.

> **These figures predate the animation trace.** They were measured on the engine as it
> stood in `reference/romania_search.rs`, before `search()` began recording a frontier
> snapshot at every expansion. Re-measured on 2026-08-20, Arad → Bucharest: the
> pre-trace engine runs at 0.52–0.85 µs, the shipped crate at 3.1–3.6 µs. The gap is not
> a build artefact — the crate was built at `opt-level 3` against the reference's
> `opt-level 2` — and is most likely the two `Vec` allocations `make_step()` performs per
> expansion, though that has not been isolated by an experiment. The counts below are
> unaffected, which is the reason invariant I5 reports expansions rather than time.

| Operation | C++ | Rust | Python |
|---|---|---|---|
| UCS search | 0.387 µs | 0.395 µs | 11.32 µs |
| A* search | 0.396 µs | 0.377 µs | 9.52 µs |
| Heuristic build (Gauss-Jordan) | ~13 µs | ~13 µs | ~390 µs |
| Expanded (UCS / A*) | 13 / 9 | 13 / 9 | 13 / 9 |

Verification across all 400 start/goal pairs:

```
cost mismatches:           0
admissibility violations:  0      h(v) ≤ h*(v)
consistency violations:    0      h(u) ≤ w(u,v) + h(v)
total expansions:   UCS 4200 → A* 2436   (42% reduction)
h/h* ratio:  min 0.433, mean 0.714, max 1.000
```

Two facts follow from this table and drive everything else:

1. **The search is effectively free.** Under a microsecond in compiled code.
   Any device can run it.
2. **The heuristic build costs ~30× a search.** It is the only part of the
   workload with a meaningful cost, and it is *per goal*, not per query.

---

## What is faster, and why

### Language: compiled beats interpreted by ~30×

| | UCS | A* |
|---|---|---|
| C++ | 0.387 µs | 0.396 µs |
| Rust | 0.395 µs | 0.377 µs |
| Python | 11.32 µs | 9.52 µs |

C++ and Rust are indistinguishable from each other — expected, since both
compile to native code through similar optimising backends and the program is
the same handful of array operations. Python is roughly **30× slower**, because
every heap push, tuple comparison, and loop iteration goes through bytecode
dispatch and allocates boxed objects, where the compiled versions use raw stack
values and inlined comparisons.

This is the clearest and most reliable result in the project.

### A* vs UCS: the answer depends on the language

A* expands 9 nodes to UCS's 13 — a 31% reduction — in **every** language,
because the algorithm is identical. Runtime does not follow:

| Language | A* / UCS runtime ratio | Consistency | Verdict |
|---|---|---|---|
| Python | **0.84** | 8 of 8 runs below 1.00 | A* ~16% faster |
| Rust | **~1.00** | ratios span 0.93–1.09, no consistent sign | indistinguishable |
| C++ | **~1.02** | 15 of 15 runs above 1.00 | no speedup; ~2% slower |

**The same algorithmic saving produces a clear win in Python and no win at all
in compiled code.**

### Why

Model each search as a fixed setup cost plus a per-expansion cost:

```
T  =  F  +  k × expansions
```

Solving from the two measured points in each language (13 vs 9 expansions):

| | marginal cost per expansion (`k`) | fixed cost (`F`) |
|---|---|---|
| Python | **~0.45 µs** | ~5.5 µs |
| C++ | **≈ 0** (below the noise floor) | — |

In Python, one node expansion costs about 0.45 µs of interpreter work, so
removing four of them saves ~1.8 µs — a real, repeatable 16%.

In C++, a node expansion is roughly 20–30 ns. Removing four saves on the order
of **100 ns**, and that saving is invisible because:

- **Fixed per-search cost is comparable.** Every call allocates `best`,
  `parent`, `settled`, `explored_order`, and the priority queue's backing
  store. Measured in isolation, that container setup alone costs **~0.08 µs**
  — around 20% of the whole search, and it is identical for both algorithms.
- **Run-to-run variance is larger than the effect.** Across 15 launches, UCS
  alone ranged 0.356–0.541 µs — a spread of ~185 ns, well above the ~100 ns
  the heuristic could theoretically save.

So in compiled code the effect being measured is smaller than the measurement
error, by construction. The residual ~2% is roughly 9 ns and should not be
attributed to any specific mechanism — it is not evidence that the heuristic
costs anything meaningful, only that it buys nothing here.

### The heuristic does not pay for itself at this graph size

Break-even = build cost ÷ saving per query:

| | build | saving per query | break-even |
|---|---|---|---|
| Python | ~390 µs | ~1.8 µs | **~220 queries to the same goal** |
| C++ / Rust | ~13 µs | ~0 | **never** |

For a single query the current-flow heuristic is strictly a net loss in every
language. It only makes sense amortised across many queries to the same goal —
which is the argument for precomputing it once, whether at server boot
or at build time. The wasm build does it at build time.

### Architecture: network dominates everything

| | Time to a result |
|---|---|
| TypeScript in browser | ~10–50 µs (search + heuristic build) |
| Rust → WASM in browser | ~10–50 µs, plus JS↔WASM boundary crossing |
| Rust backend over HTTP | **30–200 ms** |

The compute differences between these are measured in microseconds; the network
difference is measured in **hundreds of milliseconds**. A backend is three to
four orders of magnitude slower end-to-end, and no amount of Rust changes that
— which is why the case for a backend rested on heuristic amortisation and
single-source-of-truth, never speed.

### Measurement warnings

- **Never quote a single run.** The first launch of the C++ binary measured
  0.541 µs; the fifteenth measured 0.359 µs — a 1.5× drift from CPU frequency
  ramp-up and cache warming alone. Take medians across many launches.
- **A 20-node graph is too small to time reliably.** Expansion counts are exact
  and machine-independent; runtimes at this scale are dominated by allocation
  and noise. Report both, and trust the counts.
- **Both algorithms allocate five containers per call.** The benchmark
  therefore measures allocation as much as search. Hoisting those buffers out
  of `search()` and reusing them across runs would make the per-expansion cost
  visible in compiled code — worth trying if the runtime comparison matters.

---

## The concept the architecture rests on: the trace

The animation cannot be reconstructed from a finished search result. The final
`explored_order` records *which* nodes were expanded and in what order, but not
*what was sitting in the priority queue* at each step — and the frontier is the
interesting thing to visualise.

So the search records a snapshot at each expansion:

```
step 0:  expanded = Arad,    frontier = [Zerind, Timisoara, Sibiu],  g = {...}
step 1:  expanded = Zerind,  frontier = [Timisoara, Sibiu, Oradea],  g = {...}
step 2:  ...
```

Roughly 13 steps for UCS, 9 for A*. A few KB total.

The UI then animates by advancing a single `stepIndex` through this array.
Pause, rewind, scrub, and speed control are all just index changes — no
recomputation, and with a backend, no additional network calls either.

**This applies whichever architecture is used.** It is the single most important
structural decision in the project.

---

## Rejected — TypeScript in the browser

The algorithms are ported to TypeScript and run on the visitor's device.

### Logic

```
1. User picks start and goal
2. Browser builds the heuristic for that goal   (Gauss-Jordan, ~13-50 µs)
3. Browser runs UCS                             (all-zero heuristic)
4. Browser runs A*                              (current-flow heuristic)
5. Both return result + trace
6. Animation walks the trace
```

Everything happens in one JavaScript call stack. No network, no latency, no
failure modes.

### Structure

```
lib/
  graph.ts          20 cities, 23 roads, adjacency list
  graph-data.ts     coordinates + GeoJSON feature collections
  search.ts         UCS + A*
  heuristic.ts      weighted Laplacian + Gauss-Jordan inverse
  trace.ts          step-by-step timeline type

components/
  GraphView.tsx     inline SVG schematic (no dependencies)
  MapView.tsx       react-map-gl + MapLibre (lazy-loaded)
  Charts.tsx        Recharts (lazy-loaded)
  Controls.tsx      city selectors, play/pause, speed

store/
  useSearchStore.ts Zustand: start, goal, trace, stepIndex, results
```

**Rule:** nothing in `lib/` imports React, Zustand, or MapLibre. It stays pure
so Vitest can test it directly and so it mirrors the Rust file 1:1.

### Deployment

```
GitHub Actions → next build (output: 'export') → GitHub Pages
```

Static files only. No server exists at runtime.

### Trade-offs

| | |
|---|---|
| ✅ | Zero latency — results are instant |
| ✅ | Free and permanent hosting; still works years later |
| ✅ | No CORS, no TLS, no uptime, no credentials |
| ✅ | Trivially testable with Vitest |
| ✅ | Works offline once loaded |
| ❌ | The algorithm exists twice (Rust + TypeScript) and can drift |
| ❌ | Heuristic is rebuilt per goal selection in every visitor's browser |

---

## Rejected — a Rust HTTP backend

The existing Rust becomes the single source of truth and is served over HTTP.

### Justification

Not speed. A network round trip from Bangkok is 30–200 ms against a 1 µs
computation — the network is ~100,000× the work being sent.

The real justification is **amortising the heuristic**. A server computes all
20 goal heuristics once at boot and reuses them for every request from every
user, forever. That is exactly the multi-query regime where the current-flow
heuristic pays for itself, and it removes the ~220-query break-even entirely.

### Logic — startup (once)

```
1. Build the graph
2. For each of the 20 possible goals:
       build the weighted Laplacian
       ground that goal, invert the reduced matrix
       store the resulting effective-resistance table
   → 20 heuristic tables held in memory
3. Start listening
```

### Logic — per request

```
Browser  ──▶  { start: 0, goal: 12 }

Server:
  1. validate both indices are 0..19
  2. UCS   = search(graph, start, goal, zeros)
  3. A*    = search(graph, start, goal, cached_heuristic[goal])   ← lookup only
  4. package both results, each with its trace

Server  ──▶  { ucs: {...}, astar: {...} }
```

A* performs no heuristic work at request time. UCS and A* cost the same to
serve.

### Logic — browser playback

```
1. Receive the JSON            ← exactly one network call
2. Store in Zustand
3. Timer advances stepIndex
4. Per step, read trace[stepIndex]:
       expanded city   → grey
       frontier cities → orange
       remainder       → default
   push those states into the GeoJSON; MapLibre repaints
5. On completion, paint the final path green
6. Charts read the counters
```

No network traffic after step 1.

### Structure

```
server/                         Cargo project
├── Cargo.toml                  [lib] + two binaries
└── src/
    ├── lib.rs                  graph, search, heuristic, trace  ← source of truth
    ├── bin/cli.rs              existing stdin UI + Instant benchmarks
    └── bin/server.rs           axum HTTP API

project root/                   as the TypeScript port, minus lib/search.ts
└── lib/api.ts                  fetch wrapper
```

### Changes the engine would have needed

| Current | Change |
|---|---|
| `use std::io`, `std::time::Instant`, `std::hint::black_box` | move out of `lib.rs` into `bin/cli.rs` |
| `CITIES`, `CITY_COUNT`, `Graph`, `make_graph`, `search`, `current_flow_heuristic` | add `pub` |
| `struct SearchResult` | add `#[derive(Serialize)]` and a `trace: Vec<Step>` field |
| `panic!("No route exists…")` | return `Result<SearchResult, &'static str>` |
| `benchmark()`, `select_city()`, `main()` | move verbatim into `bin/cli.rs` |

`search()` and `current_flow_heuristic()` already take `&graph` and perform no
I/O — they move across unmodified.

### API

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /api/cities` | the 20 city names |
| `POST /api/search` | `{ start, goal }` → both algorithms, both traces |

One endpoint returns both algorithms, because the UI always shows them
side by side.

### Deployment

```
GitHub Pages (frontend)  ──fetch──▶  DigitalOcean App Platform (Rust API)
```

App Platform rather than a raw Droplet: git-push deploy and managed TLS, with
no nginx, certbot, systemd, or SSH hardening to maintain.

### Requirements that will otherwise block you

- **The API must serve HTTPS.** GitHub Pages is `https://`, and browsers hard-block
  `http://` requests from an `https://` page as mixed content. A bare IP address
  will not work.
- **CORS must allow the Pages origin**, and should be locked to that origin
  rather than `Any`.
- **`NEXT_PUBLIC_API_URL` is baked in at build time**, not read at runtime.
  Changing it requires a rebuild.
- **The frontend needs loading and error states.** Network calls fail; function
  calls do not.

### Trade-offs

| | |
|---|---|
| ✅ | One implementation of the algorithm — no drift |
| ✅ | Heuristic amortised across all users, computed once |
| ✅ | Rust is the deployed artefact, not a side experiment |
| ❌ | 30–200 ms per query instead of ~0 |
| ❌ | Must stay running and funded to keep working |
| ❌ | TLS, CORS, uptime, error handling, loading states |
| ❌ | Dies when Student Pack credit expires unless migrated |

---

## Chosen — Rust compiled to WebAssembly

Compile the engine to `wasm32-unknown-unknown` and run the same Rust in the browser:
one implementation of the algorithm, and no server to keep alive.

Two caveats recorded here have since been answered:

- `std::time::Instant` panics on `wasm32-unknown-unknown`, so `benchmark()` stays in
  `bin/cli.rs`. That is now invariant I4, enforced by `npm run verify:invariants`.
- The heuristic is **not** recomputed per visitor. All twenty goal tables are computed
  at build time and embedded by `wasm/build.rs`, so the browser never runs
  Gauss-Jordan. This removed the only real advantage a backend had.

Still true: the JS↔WASM boundary crossing costs roughly as much as the 1 µs search
itself, so expect no speedup from running in the browser; and tests must `await`
module init.

---

## Comparison

| | TypeScript in the browser | Rust HTTP backend | **Rust + WebAssembly** |
|---|---|---|---|
| Latency per query | ~0 | 30–200 ms | ~0 |
| Single algorithm implementation | ❌ | ✅ | ✅ |
| Heuristic amortised | ❌ | ✅ at boot | ✅ at build time |
| Hosting cost | free | ~$6/mo after credit | free |
| Still working in 2 years | ✅ | only if funded | ✅ |
| Works offline | ✅ | ❌ | ✅ |
| Build complexity | none | Docker + deploy | Rust toolchain in CI |
| Testing | easiest | needs a running server | async init |
| Failure modes | none | CORS, TLS, downtime | none |

---

## Constant regardless

**Benchmarks stay native.** Runtime timings come from `bin/cli.rs` run on bare
metal, exported to `benchmarks.json`, committed, and charted by Recharts.

Browser timing cannot be used: `performance.now()` is coarsened to ~100 µs in
Chrome as a Spectre mitigation, against a 1 µs search. Timing an HTTP request
measures the network, not the algorithm. Neither WASM nor a backend fixes this.

**Report expansion counts, not just runtime.** `expanded`, `generated`, and
`peak_frontier` are exact integers, identical on every machine, and are the
honest comparison. The headline result is that a 31% reduction in expanded
nodes yields ~16% less runtime in Python and **no measurable gain in C++ or
Rust** — see "What is faster, and why" above. That is a genuine finding about
where heuristic search pays off, and worth reporting rather than hiding.

**Build the SVG graph view before the map.** It has no dependencies, works on
any device including those without WebGL, loads instantly, and does not imply a
geographic precision the data lacks — the 23 edge weights are the standard
benchmark distances, not real road or great-circle distances. Treat MapLibre as
an enhancement layered on top of a project that already works.

**No tile provider is a data source by itself.** OpenStreetMap is data, not a
service MapLibre can point at. A vector tile provider is required — OpenFreeMap
needs no API key and is the simplest starting point. Self-hosted Protomaps
`.pmtiles` is the zero-dependency alternative, but exceeds GitHub's 100 MB file
limit and needs object storage.

---

## Decision

**Rust compiled to WebAssembly**, locked in `CLAUDE.md`.

An earlier draft of this file recommended the TypeScript port, as the smallest thing
that satisfied the assignment. That was overturned: the algorithm would exist twice and
drift, and drift silently invalidates the comparison this project is about. Precomputing
the heuristic at build time then removed the backend's only genuine advantage, leaving it
with nothing but its costs — ~$6/month, 30–200 ms of network for 0.4 µs of work, and a
site that goes dark when funding stops.

**A backend becomes correct again** if a live deployed service is itself a goal, or
if the graph is ever scaled to the real Romanian road network. The heuristic's O(V³) time and O(V²) memory
make browser-side precompute infeasible well before that point:

| V | Inversion | Memory |
|---|---|---|
| 20 | ~13 µs | 9 KB |
| 1,000 | ~1 s | 8 MB |
| 10,000 | ~15 min | 800 MB |

If a backend is ever adopted, keep a local fallback so the site degrades to a working
state rather than an error screen when the API is unreachable.
