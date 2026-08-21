// lib/wasm/client.ts

import type { SearchResponse, SearchResult, SearchStep } from "../types";

type WasmModule = {
  default: (input?: { module_or_path: string | URL }) => Promise<unknown>;
  searchPairJson: (start: number, goal: number) => string;
};

let wasmModulePromise: Promise<WasmModule> | null = null;

function publicUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
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
  if (!Number.isInteger(start) || !Number.isInteger(goal)) {
    throw new Error("Start and destination must be valid city indices.");
  }

  const wasm = await loadWasm();
  const result: unknown = JSON.parse(wasm.searchPairJson(start, goal));
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
    isNumberArray(value.path) &&
    isNumberArray(value.explored_order) &&
    Array.isArray(value.trace) &&
    value.trace.every(isSearchStep) &&
    typeof value.cost === "number" &&
    typeof value.expanded === "number" &&
    typeof value.generated === "number" &&
    typeof value.peak_frontier === "number" &&
    typeof value.peak_records === "number" &&
    typeof value.peak_payload_bytes === "number"
  );
}

function isSearchStep(value: unknown): value is SearchStep {
  return (
    isRecord(value) &&
    typeof value.expanded_city === "number" &&
    typeof value.expanded_cost === "number" &&
    Array.isArray(value.frontier) &&
    Array.isArray(value.discovered)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}
