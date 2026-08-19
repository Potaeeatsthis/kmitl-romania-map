#!/usr/bin/env python3
"""Invariant I3 — the current-flow heuristic stays admissible and consistent.

Checks every one of the 400 start/goal pairs against an independent Dijkstra,
so a regression in search() or current_flow_heuristic() cannot pass unnoticed.
A* only returns optimal paths while admissibility holds, which makes this the
check that protects the project's central claim.

Run via: npm run verify:correctness
"""

from __future__ import annotations

import heapq
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "reference"))

import romania_search as R  # noqa: E402

EPS = 1e-9
N = len(R.CITIES)


def dijkstra(source: int) -> list[float]:
    """Shortest path costs from source, independent of the code under test."""
    dist = [float("inf")] * N
    dist[source] = 0.0
    queue = [(0.0, source)]
    while queue:
        cost, city = heapq.heappop(queue)
        if cost > dist[city]:
            continue
        for neighbor, road in R.GRAPH[city]:
            if cost + road < dist[neighbor]:
                dist[neighbor] = cost + road
                heapq.heappush(queue, (cost + road, neighbor))
    return dist


def main() -> int:
    true_cost = [dijkstra(city) for city in range(N)]
    zeros = [0.0] * N

    cost_mismatches: list[str] = []
    admissibility: list[str] = []
    consistency: list[str] = []
    ucs_expanded = astar_expanded = 0

    for goal in range(N):
        heuristic, _ = R.current_flow_heuristic(goal)

        if abs(heuristic[goal]) > EPS:
            admissibility.append(
                f"h({R.CITIES[goal]} -> itself) = {heuristic[goal]:.6f}, expected 0"
            )

        # h(v) must never exceed the true remaining cost.
        for city in range(N):
            if heuristic[city] > true_cost[city][goal] + EPS:
                admissibility.append(
                    f"h({R.CITIES[city]} -> {R.CITIES[goal]}) = {heuristic[city]:.3f} "
                    f"> h* = {true_cost[city][goal]:.3f}"
                )

        # h(u) <= w(u,v) + h(v) on every edge.
        for u in range(N):
            for v, road in R.GRAPH[u]:
                if heuristic[u] > road + heuristic[v] + EPS:
                    consistency.append(
                        f"goal {R.CITIES[goal]}: h({R.CITIES[u]}) = {heuristic[u]:.3f} "
                        f"> {road} + h({R.CITIES[v]}) = {road + heuristic[v]:.3f}"
                    )

        for start in range(N):
            ucs = R.search(start, goal, zeros)
            astar = R.search(start, goal, heuristic)
            ucs_expanded += ucs.expanded
            astar_expanded += astar.expanded
            if ucs.cost != astar.cost or ucs.cost != true_cost[start][goal]:
                cost_mismatches.append(
                    f"{R.CITIES[start]} -> {R.CITIES[goal]}: "
                    f"ucs={ucs.cost} astar={astar.cost} true={true_cost[start][goal]}"
                )

    reduction = (1 - astar_expanded / ucs_expanded) * 100

    def report(name: str, problems: list[str]) -> None:
        mark = "ok  " if not problems else "FAIL"
        print(f"  {mark} {name}: {len(problems)}")
        for line in problems[:5]:
            print(f"       {line}")
        if len(problems) > 5:
            print(f"       ... and {len(problems) - 5} more")

    print(f"I3 — heuristic correctness over all {N * N} start/goal pairs")
    report("cost mismatches", cost_mismatches)
    report("admissibility violations", admissibility)
    report("consistency violations", consistency)
    print(
        f"  ok   expansions: UCS {ucs_expanded} -> A* {astar_expanded} "
        f"({reduction:.1f}% reduction)"
    )

    failed = bool(cost_mismatches or admissibility or consistency)
    print()
    print("correctness: FAIL" if failed else "correctness: PASS")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
