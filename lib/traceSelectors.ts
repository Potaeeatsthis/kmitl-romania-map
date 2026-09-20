// lib/traceSelectors.ts
import type { SearchResponse } from "./types";

export function getTimelineLength(data: SearchResponse | null): number {
  if (!data) {
    return 0;
  }

  return Math.max(
    data.ucs.trace.length,
    data.astar.trace.length,
  );
}

export function getTraceFrame(
  data: SearchResponse | null,
  algorithm: "ucs" | "astar",
  step: number,
) {
  if (!data) {
    return undefined;
  }

  const trace = data[algorithm].trace;

  if (trace.length === 0) {
    return undefined;
  }

  const index = Math.min(Math.max(step, 0), trace.length - 1);

  return trace[index];
}

export function getExpandedCities(
  data: SearchResponse | null,
  algorithm: "ucs" | "astar",
  step: number,
): Set<number> {
  if (!data) {
    return new Set<number>();
  }

  const exploredOrder = data[algorithm].explored_order;
  const index = Math.min(
    Math.max(step, 0),
    exploredOrder.length - 1,
  );

  return new Set(exploredOrder.slice(0, index + 1));
}

export function getExpandedPathPrefix(path: number[], expanded: Set<number>): number[] {
  const firstUnexpandedIndex = path.findIndex((city) => !expanded.has(city));
  return firstUnexpandedIndex === -1 ? path : path.slice(0, firstUnexpandedIndex);
}

export function getFrontierCities(
  frame: ReturnType<typeof getTraceFrame>,
): Set<number> {
  return new Set(
    frame?.frontier.map((node) => node.city) ?? [],
  );
}

export function getFinalPath(
  data: SearchResponse | null,
  ucsComplete: boolean,
  astarComplete: boolean,
): Set<number> {
  return new Set([
    ...(ucsComplete ? data?.ucs.path ?? [] : []),
    ...(astarComplete ? data?.astar.path ?? [] : []),
  ]);
}
