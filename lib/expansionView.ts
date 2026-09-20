// lib/expansionView.ts
//
// A* expands the city with the lowest f = g + h in the ENTIRE frontier, not
// just the neighbours of the city it last expanded. So the city expanded next
// is frequently not adjacent to the focus city and not the next hop on the
// final route. This module turns one recorded trace frame into a view the
// circuit page can draw without inventing a road: only candidates the focus
// city is actually wired to get an edge key.
import type { SearchStep } from "./types";

export function edgeKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

export type ExpansionCandidate = {
  city: number;
  /** g: distance so far to reach this city. */
  cost: number;
  /** f = g + h: the number A* actually orders the frontier by. */
  priority: number;
  /** The lowest-f candidate, i.e. the city A* expands next. */
  isChosen: boolean;
  /** A direct road connects this candidate to the focus city. */
  isAdjacent: boolean;
};

export type ExpansionView = {
  /** The whole frontier, lowest f first. */
  candidates: ExpansionCandidate[];
  chosenNextId: number | null;
  chosenIsAdjacent: boolean;
  adjacent: ExpansionCandidate[];
  nonAdjacent: ExpansionCandidate[];
  /** Direct road to the next expanded city, if one exists; not a route hop. */
  hotEdges: Set<string>;
  /** Roads from the focus to adjacent candidates that lost to the winner. */
  consideredEdges: Set<string>;
};

/**
 * Builds the frontier view for the trace frame in which `focusCity` was
 * expanded. `neighborIds` is the set of cities wired directly to `focusCity`.
 * Returns null when the frame does not exist.
 */
export function buildExpansionView(
  trace: SearchStep[],
  stepIndex: number,
  focusCity: number,
  neighborIds: ReadonlySet<number>,
): ExpansionView | null {
  if (stepIndex < 0 || stepIndex >= trace.length) return null;

  const step = trace[stepIndex];
  const chosenNextId = trace[stepIndex + 1]?.expanded_city ?? null;

  const candidates: ExpansionCandidate[] = step.frontier
    .map((node) => ({
      city: node.city,
      cost: node.cost,
      priority: node.priority,
      isChosen: node.city === chosenNextId,
      isAdjacent: neighborIds.has(node.city),
    }))
    .sort((a, b) => a.priority - b.priority || a.cost - b.cost || a.city - b.city);

  const adjacent = candidates.filter((candidate) => candidate.isAdjacent);
  const nonAdjacent = candidates.filter((candidate) => !candidate.isAdjacent);

  const hotEdges = new Set<string>();
  if (chosenNextId !== null && neighborIds.has(chosenNextId)) {
    hotEdges.add(edgeKey(focusCity, chosenNextId));
  }

  const consideredEdges = new Set<string>();
  for (const candidate of adjacent) {
    if (!candidate.isChosen) consideredEdges.add(edgeKey(focusCity, candidate.city));
  }

  return {
    candidates,
    chosenNextId,
    chosenIsAdjacent: chosenNextId !== null && neighborIds.has(chosenNextId),
    adjacent,
    nonAdjacent,
    hotEdges,
    consideredEdges,
  };
}
