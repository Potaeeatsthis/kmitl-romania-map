import type { HeuristicExplanation } from "./types";

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
