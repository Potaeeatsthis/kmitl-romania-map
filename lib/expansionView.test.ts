// lib/expansionView.test.ts
import { describe, expect, it } from "vitest";

import type { SearchStep } from "./types";
import { buildExpansionView, edgeKey } from "./expansionView";

function step(expandedCity: number, frontier: SearchStep["frontier"]): SearchStep {
  return { expanded_city: expandedCity, expanded_cost: 0, frontier, discovered: [] };
}

describe("buildExpansionView", () => {
  it("does not invent a road to a non-adjacent next expanded city", () => {
    // A* expands city 2 next even though city 2 has no road from city 1.
    const trace: SearchStep[] = [
      step(1, [
        { city: 2, cost: 1, priority: 2 },
        { city: 3, cost: 2, priority: 3 },
      ]),
      step(2, []),
    ];

    const view = buildExpansionView(trace, 0, 1, new Set([3]));

    expect(view).not.toBeNull();
    expect(view!.chosenNextId).toBe(2);
    expect(view!.chosenIsAdjacent).toBe(false);
    expect(view!.hotEdges.size).toBe(0);
    expect(view!.nonAdjacent.map((candidate) => candidate.city)).toEqual([2]);
    expect(view!.adjacent.map((candidate) => candidate.city)).toEqual([3]);
    expect(view!.consideredEdges).toEqual(new Set([edgeKey(1, 3)]));
    // The whole frontier is kept, sorted by f, so the page can show that A*
    // compares every waiting city, not just the neighbours.
    expect(view!.candidates.map((candidate) => candidate.city)).toEqual([2, 3]);
  });

  it("highlights the road only when the next expanded city is a real neighbour", () => {
    const trace: SearchStep[] = [
      step(1, [
        { city: 3, cost: 2, priority: 3 },
        { city: 2, cost: 1, priority: 2 },
      ]),
      step(3, []),
    ];

    const view = buildExpansionView(trace, 0, 1, new Set([3]));

    expect(view!.chosenNextId).toBe(3);
    expect(view!.chosenIsAdjacent).toBe(true);
    expect(view!.hotEdges).toEqual(new Set([edgeKey(1, 3)]));
    expect(view!.consideredEdges.size).toBe(0);
  });

  it("returns null when the trace frame is missing", () => {
    expect(buildExpansionView([], 0, 1, new Set())).toBeNull();
    expect(buildExpansionView([step(1, [])], -1, 1, new Set())).toBeNull();
  });
});
