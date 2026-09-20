#!/usr/bin/env python3
"""Compare UCS with current-flow A* on the 20-city Romania map."""

from __future__ import annotations

import heapq
import math
import time
from dataclasses import dataclass


CITIES = [
    "Arad", "Zerind", "Oradea", "Sibiu", "Timisoara", "Lugoj",
    "Mehadia", "Drobeta", "Craiova", "Rimnicu Vilcea", "Pitesti",
    "Fagaras", "Bucharest", "Giurgiu", "Urziceni", "Hirsova",
    "Eforie", "Vaslui", "Iasi", "Neamt",
]

ROADS = [
    ("Arad", "Zerind", 75), ("Zerind", "Oradea", 71),
    ("Oradea", "Sibiu", 151), ("Arad", "Sibiu", 140),
    ("Arad", "Timisoara", 118), ("Timisoara", "Lugoj", 111),
    ("Lugoj", "Mehadia", 70), ("Mehadia", "Drobeta", 75),
    ("Drobeta", "Craiova", 120), ("Craiova", "Rimnicu Vilcea", 146),
    ("Craiova", "Pitesti", 138), ("Sibiu", "Rimnicu Vilcea", 80),
    ("Sibiu", "Fagaras", 99), ("Rimnicu Vilcea", "Pitesti", 97),
    ("Fagaras", "Bucharest", 211), ("Pitesti", "Bucharest", 101),
    ("Bucharest", "Giurgiu", 90), ("Bucharest", "Urziceni", 85),
    ("Urziceni", "Hirsova", 98), ("Hirsova", "Eforie", 86),
    ("Urziceni", "Vaslui", 142), ("Vaslui", "Iasi", 92),
    ("Iasi", "Neamt", 87),
]

BENCHMARK_RUNS = 5_000
INF = math.inf


def make_graph() -> list[list[tuple[int, int]]]:
    index = {name: i for i, name in enumerate(CITIES)}
    graph: list[list[tuple[int, int]]] = [[] for _ in CITIES]
    for first, second, distance in ROADS:
        a, b = index[first], index[second]
        graph[a].append((b, distance))
        graph[b].append((a, distance))
    return graph


GRAPH = make_graph()


@dataclass
class SearchResult:
    path: list[int]
    explored_order: list[int]
    cost: int
    expanded: int
    generated: int
    peak_frontier: int
    peak_records: int
    peak_payload_bytes: int


def search(start: int, goal: int, heuristic: list[float]) -> SearchResult:
    """Run UCS when heuristic is all zeroes, otherwise run A*."""
    best = [INF] * len(CITIES)
    parent = [-1] * len(CITIES)
    settled = [False] * len(CITIES)
    frontier: list[tuple[float, int, int]] = []
    best[start] = 0
    heapq.heappush(frontier, (heuristic[start], 0, start))

    expanded = 0
    generated = 1
    discovered = 1
    peak_frontier = 1
    peak_records = 2  # one frontier item + one discovered-city record
    peak_payload = 32  # (f, g, city)=20 bytes + (best, parent)=12 bytes
    explored_order: list[int] = []

    def update_peaks() -> None:
        nonlocal peak_frontier, peak_records, peak_payload
        frontier_count = len(frontier)
        settled_count = expanded
        peak_frontier = max(peak_frontier, frontier_count)
        peak_records = max(peak_records, frontier_count + discovered + settled_count * 2)
        # Language-neutral field payload, excluding container/object overhead.
        peak_payload = max(
            peak_payload,
            frontier_count * 20 + discovered * 12 + settled_count * 5,
        )

    while frontier:
        _, current_cost, current = heapq.heappop(frontier)
        if current_cost != best[current] or settled[current]:
            continue
        settled[current] = True
        expanded += 1
        explored_order.append(current)
        update_peaks()

        if current == goal:
            path = []
            node = goal
            while node != -1:
                path.append(node)
                node = parent[node]
            path.reverse()
            return SearchResult(
                path, explored_order, current_cost, expanded, generated, peak_frontier,
                peak_records, peak_payload,
            )

        for neighbor, road_cost in GRAPH[current]:
            if settled[neighbor]:
                continue
            new_cost = current_cost + road_cost
            if new_cost < best[neighbor]:
                if best[neighbor] == INF:
                    discovered += 1
                best[neighbor] = new_cost
                parent[neighbor] = current
                heapq.heappush(
                    frontier,
                    (new_cost + heuristic[neighbor], new_cost, neighbor),
                )
                generated += 1
                update_peaks()

    raise ValueError("No route exists between the selected cities")


def current_flow_heuristic(goal: int) -> tuple[list[float], int]:
    """Return effective resistance from every city to a grounded goal."""
    size = len(CITIES)
    laplacian = [[0.0] * size for _ in range(size)]
    for a in range(size):
        for b, distance in GRAPH[a]:
            conductance = 1.0 / distance
            laplacian[a][a] += conductance
            laplacian[a][b] -= conductance

    kept = [city for city in range(size) if city != goal]
    reduced_size = size - 1
    # [L_reduced | identity], transformed in-place by Gauss-Jordan elimination.
    augmented = [
        [laplacian[row][col] for col in kept]
        + [1.0 if i == j else 0.0 for j in range(reduced_size)]
        for i, row in enumerate(kept)
    ]

    for column in range(reduced_size):
        pivot = max(range(column, reduced_size), key=lambda r: abs(augmented[r][column]))
        if abs(augmented[pivot][column]) < 1e-14:
            raise ArithmeticError("The road graph must be connected")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(reduced_size):
            if row == column:
                continue
            factor = augmented[row][column]
            if factor != 0.0:
                augmented[row] = [
                    augmented[row][j] - factor * augmented[column][j]
                    for j in range(2 * reduced_size)
                ]

    heuristic = [0.0] * size
    for reduced_index, city in enumerate(kept):
        # Diagonal of the inverse grounded Laplacian is R_eff(city, goal).
        heuristic[city] = max(0.0, augmented[reduced_index][reduced_size + reduced_index])

    logical_workspace = size * size * 8 + reduced_size * (2 * reduced_size) * 8 + size * 8
    return heuristic, logical_workspace


def benchmark(start: int, goal: int, heuristic: list[float]) -> tuple[SearchResult, float]:
    result = search(start, goal, heuristic)  # warm-up and result to display
    checksum = 0
    began = time.perf_counter_ns()
    for _ in range(BENCHMARK_RUNS):
        measured = search(start, goal, heuristic)
        checksum ^= measured.cost + measured.expanded
    elapsed = time.perf_counter_ns() - began
    if checksum == -1:  # keeps the benchmark result observably used
        print("unreachable")
    return result, elapsed / BENCHMARK_RUNS / 1_000.0


def select_city(prompt: str) -> int:
    lookup = {name.casefold(): i for i, name in enumerate(CITIES)}
    while True:
        answer = input(prompt).strip().casefold()
        if answer in lookup:
            return lookup[answer]
        print("Unknown city. Enter one of the names shown above.")


def path_text(result: SearchResult) -> str:
    return " -> ".join(CITIES[city] for city in result.path)


def explored_text(result: SearchResult) -> str:
    return " -> ".join(CITIES[city] for city in result.explored_order)


def main() -> None:
    print("Romania map (20 cities):")
    print(", ".join(CITIES))
    start = select_city("Current city: ")
    goal = select_city("Goal city: ")

    build_start = time.perf_counter_ns()
    heuristic, heuristic_workspace = current_flow_heuristic(goal)
    build_us = (time.perf_counter_ns() - build_start) / 1_000.0

    ucs, ucs_us = benchmark(start, goal, [0.0] * len(CITIES))
    astar, astar_us = benchmark(start, goal, heuristic)

    print("\nRoutes")
    print(f"UCS:             {path_text(ucs)} (cost {ucs.cost} km)")
    print(f"Current-flow A*: {path_text(astar)} (cost {astar.cost} km)")
    print("\nExplored order")
    print(f"UCS:             {explored_text(ucs)}")
    print(f"Current-flow A*: {explored_text(astar)}")
    print(f"\nAverage search time over {BENCHMARK_RUNS:,} runs (heuristic build excluded)")
    print(f"{'Algorithm':<18}{'Runtime (us)':>14}{'Expanded':>11}{'Generated':>11}{'Peak queue':>12}{'Peak records':>14}{'Memory (B)':>14}")
    print(f"{'UCS':<18}{ucs_us:>14.3f}{ucs.expanded:>11}{ucs.generated:>11}{ucs.peak_frontier:>12}{ucs.peak_records:>14}{ucs.peak_payload_bytes:>14}")
    print(f"{'Current-flow A*':<18}{astar_us:>14.3f}{astar.expanded:>11}{astar.generated:>11}{astar.peak_frontier:>12}{astar.peak_records:>14}{astar.peak_payload_bytes:>14}")
    print(f"\nA* heuristic build: {build_us:.3f} us; logical numeric workspace: {heuristic_workspace} bytes")
    print("Units: runtime is microseconds (us); logical search memory is bytes (B).")
    print("Memory is a language-neutral count of stored fields; runtime/container overhead is excluded.")
    if ucs.cost == astar.cost:
        print("Both algorithms found the same optimal route cost.")


if __name__ == "__main__":
    main()
