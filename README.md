# Romania Map Search Comparison

This project compares a blind search algorithm with a heuristic search
algorithm on the classic 20-city Romania road map.

- **Blind search:** Uniform-Cost Search (UCS)
- **Heuristic search:** A* with a current-flow effective-resistance heuristic
- **Languages:** Python, C++, and Rust

The detailed project idea and mathematics are available in
[`4-aug-2026_idea.md`](4-aug-2026_idea.md).

## Current project status

The implementation is complete. The Python, C++, and Rust programs:

- use the same 20 cities, roads, and distances;
- accept a current city and goal city from the user;
- run UCS and current-flow A* for the selected route;
- report the path, explored-node order, distance, runtime, generated nodes,
  and memory-space metrics;
- require no third-party libraries;
- have been compiled and tested successfully; and
- produced matching optimal costs for all 400 possible start/goal pairs.

## Files

| File | Purpose |
|---|---|
| `romania_search.py` | Python 3 implementation |
| `romania_search.cpp` | C++17 implementation |
| `romania_search.rs` | Rust 2021 implementation |
| `4-aug-2026_idea.md` | Algorithm explanation and mathematical specification |

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

## Run the programs

### Python

```bash
python3 romania_search.py
```

### C++

Compile with optimization and run:

```bash
g++ -std=c++17 -O2 romania_search.cpp -o romania_search_cpp
./romania_search_cpp
```

### Rust

Compile with optimization and run:

```bash
rustc --edition=2021 -O romania_search.rs -o romania_search_rust
./romania_search_rust
```

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
