//lib/kirchhoff.ts
import type { HeuristicExplanation } from "./types";

/**
 * Currents at or below this magnitude (amps) are treated as no flow.
 *
 * The solver injects exactly 1 A and its Gauss-Jordan pivot guard is 1e-14.
 * A structurally-zero edge -- one whose endpoints sit on the same node of a
 * dangling subtree, e.g. Bucharest's Giurgiu branch -- comes out at <1e-14 A
 * of floating-point roundoff, while the smallest edge that genuinely carries
 * current in the Romania network is ~5e-4 A. 1e-9 A sits safely between the
 * two, so roundoff is suppressed without hiding any real current.
 */
export const ZERO_CURRENT_EPSILON_AMPS = 1e-9;

/** True when `current` (amps, signed) is large enough to be real flow. */
export function carriesCurrent(current: number): boolean {
  return Math.abs(current) > ZERO_CURRENT_EPSILON_AMPS;
}

export type GroundedKirchhoffSystem = {
  cityIds: number[];
  matrix: number[][];
  current: number[];
  voltage: number[];
  startIndex: number | null;
};

/**
 * Builds the grounded linear system shown by the teaching UI from the exact
 * Laplacian and Gauss-Jordan result returned by Rust.
 *
 * The destination row and column are removed to set V(goal) = 0. For a unit
 * current injected at the start, the voltage solution is the start column of
 * the inverse grounded Laplacian recorded in the final augmented matrix.
 */
export function buildGroundedKirchhoffSystem(
  explanation: HeuristicExplanation,
): GroundedKirchhoffSystem {
  const cityCount = explanation.laplacian.length;

  if (
    cityCount === 0 ||
    explanation.laplacian.some(
      (row) => row.length !== cityCount || row.some((value) => !Number.isFinite(value)),
    )
  ) {
    throw new Error("The Kirchhoff matrix must be a finite square matrix.");
  }

  const cityIds = Array.from({ length: cityCount }, (_, cityId) => cityId).filter(
    (cityId) => cityId !== explanation.goal,
  );
  const matrix = cityIds.map((rowCityId) =>
    cityIds.map((columnCityId) => explanation.laplacian[rowCityId][columnCityId]),
  );

  if (explanation.start === explanation.goal) {
    return {
      cityIds,
      matrix,
      current: cityIds.map(() => 0),
      voltage: cityIds.map(() => 0),
      startIndex: null,
    };
  }

  const startIndex = cityIds.indexOf(explanation.start);
  const finalMatrix = explanation.steps.at(-1)?.matrix_after;
  const size = cityIds.length;

  if (
    startIndex < 0 ||
    !finalMatrix ||
    finalMatrix.length !== size ||
    finalMatrix.some((row) => row.length !== size * 2)
  ) {
    throw new Error("The elimination result does not match the grounded Kirchhoff matrix.");
  }

  const voltage = finalMatrix.map((row) => row[size + startIndex]);
  if (voltage.some((value) => !Number.isFinite(value))) {
    throw new Error("The voltage solution contains a non-finite value.");
  }

  return {
    cityIds,
    matrix,
    current: cityIds.map((cityId) => (cityId === explanation.start ? 1 : 0)),
    voltage,
    startIndex,
  };
}
