// lib/heuristicQuery.ts
import { romaniaGraph } from "./romaniaGraph";

/**
 * Parses the optional query context shared by the heuristic summary and the
 * three calculation pages. `start` always names the city whose h is being
 * explained; `routeStart` and `decision` are the overall A* route context the
 * summary forwards, and `explained` is how the explained city survives the
 * return trip because the summary's own `start` is the route start.
 *
 * Both producer and consumer validate here so the contract cannot drift.
 */
export function parseCityParam(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const city = Number(value);
  return Number.isInteger(city) && city >= 0 && city < romaniaGraph.cities.length ? city : null;
}

export function parseDecisionParam(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const decision = Number(value);
  return Number.isSafeInteger(decision) ? decision : null;
}
