// lib/wasm/client.test.ts
import { describe, expect, it } from "vitest";

import sampleData from "../../public/data/arad-bucharest-search.json";
import { parseSearchResponse } from "./client";

describe("parseSearchResponse", () => {
  it("accepts the Rust-generated sample", () => {
    expect(parseSearchResponse(JSON.stringify(sampleData))).toEqual(sampleData);
  });

  it("rejects malformed frontier nodes", () => {
    const malformed = structuredClone(sampleData);
    malformed.ucs.trace[0].frontier[0].city = "Arad" as unknown as number;

    expect(() => parseSearchResponse(JSON.stringify(malformed))).toThrow(
      "Rust returned an unexpected search result format.",
    );
  });

  it("rejects malformed discovered nodes", () => {
    const malformed = structuredClone(sampleData);
    malformed.astar.trace[0].discovered[0].parent = 20;

    expect(() => parseSearchResponse(JSON.stringify(malformed))).toThrow(
      "Rust returned an unexpected search result format.",
    );
  });

  it("reports invalid JSON clearly", () => {
    expect(() => parseSearchResponse("not JSON")).toThrow("Rust returned invalid JSON.");
  });
});
