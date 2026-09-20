// lib/wasm/client.test.ts
import { describe, expect, it } from "vitest";

import sampleData from "../../public/data/arad-bucharest-search.json";
import { romaniaGraph } from "../romaniaGraph";
import type { HeuristicExplanation } from "../types";
import { parseHeuristicExplanation, parseSearchResponse } from "./client";

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

const cityCount = romaniaGraph.cities.length;
const groundedSize = cityCount - 1;
const BAD_FORMAT = "Rust returned an unexpected heuristic explanation format.";

function identityLaplacian(): number[][] {
  return Array.from({ length: cityCount }, (_, row) =>
    Array.from({ length: cityCount }, (_, column) => (row === column ? 1 : 0)),
  );
}

function inverseAugmented(): number[][] {
  return Array.from({ length: groundedSize }, (_, row) =>
    Array.from({ length: groundedSize * 2 }, (_, column) =>
      column === row || column === groundedSize + row ? 1 : 0,
    ),
  );
}

/** A full 20-city explanation with the dimensions the Rust engine emits. */
function engineExplanation(start = 0, goal = 2): HeuristicExplanation {
  return {
    start,
    goal,
    conductances: [
      { city_a: 0, city_b: 1, distance: 75, conductance: 1 / 75 },
      { city_a: 1, city_b: 2, distance: 71, conductance: 1 / 71 },
    ],
    laplacian: identityLaplacian(),
    steps: Array.from({ length: groundedSize }, (_, index) => ({
      pivot_column: index,
      pivot_row: index,
      matrix_after: inverseAugmented(),
    })),
    effective_resistance: 3.5,
  };
}

function parse(explanation: unknown) {
  return parseHeuristicExplanation(JSON.stringify(explanation));
}

describe("parseHeuristicExplanation", () => {
  it("accepts a full-size explanation shaped like the Rust engine", () => {
    const explanation = engineExplanation();
    expect(parse(explanation)).toEqual(explanation);
  });

  it("accepts a same-city explanation with or without elimination steps", () => {
    const full = engineExplanation(2, 2);
    expect(parse(full)).toEqual(full);

    const noSteps = engineExplanation(2, 2);
    noSteps.steps = [];
    expect(parse(noSteps)).toEqual(noSteps);
  });

  it("rejects an empty or ragged Laplacian", () => {
    const empty = engineExplanation();
    empty.laplacian = [];
    expect(() => parse(empty)).toThrow(BAD_FORMAT);

    const ragged = engineExplanation();
    ragged.laplacian[0] = ragged.laplacian[0].slice(0, 5);
    expect(() => parse(ragged)).toThrow(BAD_FORMAT);
  });

  it("rejects non-finite matrix entries", () => {
    const overflow = engineExplanation();
    overflow.laplacian[3][4] = Number.POSITIVE_INFINITY;
    expect(() => parse(overflow)).toThrow(BAD_FORMAT);

    const nan = engineExplanation();
    nan.steps[0].matrix_after[0][0] = Number.NaN;
    expect(() => parse(nan)).toThrow(BAD_FORMAT);
  });

  it("rejects a malformed augmented matrix shape", () => {
    const shortRow = engineExplanation();
    shortRow.steps[0].matrix_after[0] = shortRow.steps[0].matrix_after[0].slice(
      0,
      groundedSize * 2 - 1,
    );
    expect(() => parse(shortRow)).toThrow(BAD_FORMAT);

    const shortMatrix = engineExplanation();
    shortMatrix.steps[0].matrix_after = shortMatrix.steps[0].matrix_after.slice(0, groundedSize - 1);
    expect(() => parse(shortMatrix)).toThrow(BAD_FORMAT);
  });

  it("rejects pivots outside the grounded matrix", () => {
    const badColumn = engineExplanation();
    badColumn.steps[0].pivot_column = groundedSize;
    expect(() => parse(badColumn)).toThrow(BAD_FORMAT);

    const badRow = engineExplanation();
    badRow.steps[0].pivot_row = -1;
    expect(() => parse(badRow)).toThrow(BAD_FORMAT);
  });

  it("rejects an incomplete elimination for distinct cities", () => {
    const incomplete = engineExplanation();
    incomplete.steps = [];
    expect(() => parse(incomplete)).toThrow(BAD_FORMAT);
  });

  it("rejects non-positive conductance or distance", () => {
    const zeroDistance = engineExplanation();
    zeroDistance.conductances[0].distance = 0;
    expect(() => parse(zeroDistance)).toThrow(BAD_FORMAT);

    const zeroConductance = engineExplanation();
    zeroConductance.conductances[0].conductance = 0;
    expect(() => parse(zeroConductance)).toThrow(BAD_FORMAT);

    const infiniteConductance = engineExplanation();
    infiniteConductance.conductances[0].conductance = Number.POSITIVE_INFINITY;
    expect(() => parse(infiniteConductance)).toThrow(BAD_FORMAT);
  });

  it("rejects a conductance endpoint outside the graph", () => {
    const badEndpoint = engineExplanation();
    badEndpoint.conductances[0].city_b = cityCount;
    expect(() => parse(badEndpoint)).toThrow(BAD_FORMAT);
  });
});
