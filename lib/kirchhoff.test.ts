//lib/kirchhoff.test.ts
import { describe, expect, it } from "vitest";

import type { HeuristicExplanation } from "./types";
import { buildGroundedKirchhoffSystem } from "./kirchhoff";

const explanation: HeuristicExplanation = {
  start: 0,
  goal: 2,
  conductances: [],
  laplacian: [
    [3, -1, -2],
    [-1, 4, -3],
    [-2, -3, 5],
  ],
  steps: [
    {
      pivot_column: 1,
      pivot_row: 1,
      matrix_after: [
        [1, 0, 0.4, 0.1],
        [0, 1, 0.1, 0.6],
      ],
    },
  ],
  effective_resistance: 0.4,
};

describe("buildGroundedKirchhoffSystem", () => {
  it("removes the grounded goal and extracts the unit-current voltage solution", () => {
    expect(buildGroundedKirchhoffSystem(explanation)).toEqual({
      cityIds: [0, 1],
      matrix: [
        [3, -1],
        [-1, 4],
      ],
      current: [1, 0],
      voltage: [0.4, 0.1],
      startIndex: 0,
    });
  });

  it("returns the zero solution when the start is already the grounded goal", () => {
    expect(
      buildGroundedKirchhoffSystem({
        ...explanation,
        start: 2,
        effective_resistance: 0,
      }),
    ).toMatchObject({
      cityIds: [0, 1],
      current: [0, 0],
      voltage: [0, 0],
      startIndex: null,
    });
  });

  it("rejects an elimination result with dimensions that do not match the grounded matrix", () => {
    expect(() =>
      buildGroundedKirchhoffSystem({
        ...explanation,
        steps: [
          {
            pivot_column: 0,
            pivot_row: 0,
            matrix_after: [[1, 0]],
          },
        ],
      }),
    ).toThrow("does not match the grounded Kirchhoff matrix");
  });
});
