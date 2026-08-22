// lib/wasm/client.ts

import { romaniaGraph } from "../romaniaGraph";
import type {
  DiscoveredNode,
  FrontierNode,
  SearchResponse,
  SearchResult,
  SearchStep,
} from "../types";

type WasmModule = {
  default: (input?: { module_or_path: string | URL }) => Promise<unknown>;
  searchPairJson: (start: number, goal: number) => string;
};

let wasmModulePromise: Promise<WasmModule> | null = null;

function publicUrl(path: string) {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + path;
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

function assertSearchResponse(value: unknown): asserts value is SearchResponse {
  if (!isRecord(value) || !isSearchResult(value.ucs) || !isSearchResult(value.astar)) {
    throw new Error("Rust returned an unexpected search result format.");
  }
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
