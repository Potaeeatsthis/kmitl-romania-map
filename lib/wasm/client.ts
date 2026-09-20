// lib/wasm/client.ts

import { basePath } from "../basePath";
import { romaniaGraph } from "../romaniaGraph";
import type {
  ConductanceEdge,
  DiscoveredNode,
  EliminationStep,
  FrontierNode,
  HeuristicExplanation,
  SearchResponse,
  SearchResult,
  SearchStep,
} from "../types";

type WasmModule = {
  default: (input?: { module_or_path: string | URL }) => Promise<unknown>;
  searchPairJson: (start: number, goal: number) => string;
  explainCurrentFlowJson: (start: number, goal: number) => string;
};

let wasmModulePromise: Promise<WasmModule> | null = null;

function publicUrl(path: string) {
  return basePath + path;
}

async function loadWasm(): Promise<WasmModule> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const moduleUrl = publicUrl("/wasm/romania_search.js");
      const wasm = (await import(
        /* webpackIgnore: true */ moduleUrl
      )) as unknown as WasmModule;

      await wasm.default({
        module_or_path: publicUrl("/wasm/romania_search_bg.wasm"),
      });
      return wasm;
    })().catch((error: unknown) => {
      wasmModulePromise = null;
      throw error;
    });
  }

  return wasmModulePromise;
}

export async function runSearch(start: number, goal: number): Promise<SearchResponse> {
  if (!isCityIndex(start) || !isCityIndex(goal)) {
    throw new Error("Start and destination must be valid city indices.");
  }

  const wasm = await loadWasm();
  return parseSearchResponse(wasm.searchPairJson(start, goal));
}

export async function explainCurrentFlow(
  start: number,
  goal: number,
): Promise<HeuristicExplanation> {
  if (!isCityIndex(start) || !isCityIndex(goal)) {
    throw new Error("Start and destination must be valid city indices.");
  }

  const wasm = await loadWasm();
  return parseHeuristicExplanation(wasm.explainCurrentFlowJson(start, goal));
}

export function parseSearchResponse(json: string): SearchResponse {
  let result: unknown;

  try {
    result = JSON.parse(json);
  } catch {
    throw new Error("Rust returned invalid JSON.");
  }

  assertSearchResponse(result);
  return result;
}

export function parseHeuristicExplanation(json: string): HeuristicExplanation {
  let result: unknown;

  try {
    result = JSON.parse(json);
  } catch {
    throw new Error("Rust returned invalid JSON.");
  }

  assertHeuristicExplanation(result);
  return result;
}

function assertSearchResponse(value: unknown): asserts value is SearchResponse {
  if (!isRecord(value) || !isSearchResult(value.ucs) || !isSearchResult(value.astar)) {
    throw new Error("Rust returned an unexpected search result format.");
  }
}

function assertHeuristicExplanation(value: unknown): asserts value is HeuristicExplanation {
  const cityCount = romaniaGraph.cities.length;
  // The engine grounds the goal, removing its row and column, so every
  // elimination step is (cityCount - 1) x 2(cityCount - 1).
  const groundedSize = cityCount - 1;

  if (
    !isRecord(value) ||
    !isCityIndex(value.start) ||
    !isCityIndex(value.goal) ||
    !Array.isArray(value.conductances) ||
    !value.conductances.every(isConductanceEdge) ||
    !isMatrix(value.laplacian, cityCount, cityCount) ||
    !Array.isArray(value.steps) ||
    !value.steps.every((step) => isEliminationStep(step, groundedSize)) ||
    !isNonNegativeNumber(value.effective_resistance) ||
    // The engine pivots every grounded column; only a same-city explanation may
    // legitimately carry no steps, because the view model never walks them.
    (value.start !== value.goal && value.steps.length !== groundedSize)
  ) {
    throw new Error("Rust returned an unexpected heuristic explanation format.");
  }
}

function isConductanceEdge(value: unknown): value is ConductanceEdge {
  return (
    isRecord(value) &&
    isCityIndex(value.city_a) &&
    isCityIndex(value.city_b) &&
    isPositiveInteger(value.distance) &&
    isPositiveNumber(value.conductance)
  );
}

function isEliminationStep(value: unknown, size: number): value is EliminationStep {
  return (
    isRecord(value) &&
    isPivotIndex(value.pivot_column, size) &&
    isPivotIndex(value.pivot_row, size) &&
    isMatrix(value.matrix_after, size, size * 2)
  );
}

function isPivotIndex(value: unknown, size: number): value is number {
  return isNonNegativeInteger(value) && value < size;
}

function isMatrix(value: unknown, rows: number, columns: number): value is number[][] {
  return (
    Array.isArray(value) &&
    value.length === rows &&
    value.every(
      (row) => Array.isArray(row) && row.length === columns && row.every(isFiniteNumber),
    )
  );
}

function isSearchResult(value: unknown): value is SearchResult {
  return (
    isRecord(value) &&
    isCityIndexArray(value.path) &&
    isCityIndexArray(value.explored_order) &&
    Array.isArray(value.trace) &&
    value.trace.every(isSearchStep) &&
    isNonNegativeInteger(value.cost) &&
    isNonNegativeInteger(value.expanded) &&
    value.trace.length === value.expanded &&
    value.explored_order.length === value.expanded &&
    isNonNegativeInteger(value.generated) &&
    isNonNegativeInteger(value.peak_frontier) &&
    isNonNegativeInteger(value.peak_records) &&
    isNonNegativeInteger(value.peak_payload_bytes)
  );
}

function isSearchStep(value: unknown): value is SearchStep {
  return (
    isRecord(value) &&
    isCityIndex(value.expanded_city) &&
    isNonNegativeInteger(value.expanded_cost) &&
    Array.isArray(value.frontier) &&
    value.frontier.every(isFrontierNode) &&
    Array.isArray(value.discovered) &&
    value.discovered.every(isDiscoveredNode)
  );
}

function isFrontierNode(value: unknown): value is FrontierNode {
  return (
    isRecord(value) &&
    isCityIndex(value.city) &&
    isNonNegativeInteger(value.cost) &&
    isNonNegativeNumber(value.priority)
  );
}

function isDiscoveredNode(value: unknown): value is DiscoveredNode {
  return (
    isRecord(value) &&
    isCityIndex(value.city) &&
    isNonNegativeInteger(value.cost) &&
    (value.parent === null || isCityIndex(value.parent))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCityIndexArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isCityIndex);
}

function isCityIndex(value: unknown): value is number {
  return isNonNegativeInteger(value) && value < romaniaGraph.cities.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}