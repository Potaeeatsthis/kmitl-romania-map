// app/heuristic-steps/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import { explainCurrentFlow } from "../../lib/wasm/client";
import styles from "./page.module.css";

function parseCityParam(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= romaniaGraph.cities.length) {
    return null;
  }
  return parsed;
}

export default function HeuristicStepsPage() {
  const searchParams = useSearchParams();
  const startCity = parseCityParam(searchParams.get("start"));
  const destinationCity = parseCityParam(searchParams.get("goal"));

  const [explanation, setExplanation] = useState<HeuristicExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (startCity === null || destinationCity === null) {
      setExplanation(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setStepIndex(0);

    explainCurrentFlow(startCity, destinationCity)
      .then((result) => {
        if (!cancelled) setExplanation(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [startCity, destinationCity]);

  const summaryHref =
    startCity !== null && destinationCity !== null
      ? `/heuristic-summary?start=${startCity}&goal=${destinationCity}`
      : "/heuristic-summary";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>CURRENT-FLOW HEURISTIC</p>
          <h1 className={styles.title}>Step by step</h1>
        </div>
        <nav className={styles.nav}>
          <Link href="/">← Back to map</Link>
          <Link href={summaryHref}>View summary →</Link>
        </nav>
      </header>

      {startCity === null || destinationCity === null ? (
        <p className={styles.empty}>
          Choose a starting point and a destination on the map first, then come back here.
        </p>
      ) : isLoading ? (
        <p className={styles.empty}>Calculating…</p>
      ) : error ? (
        <p className={styles.errorText}>Could not calculate: {error}</p>
      ) : explanation ? (
        <StepsView
          explanation={explanation}
          stepIndex={stepIndex}
          onStepIndexChange={setStepIndex}
        />
      ) : null}
    </main>
  );
}

function StepsView({
  explanation,
  stepIndex,
  onStepIndexChange,
}: {
  explanation: HeuristicExplanation;
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
}) {
  const startName = romaniaGraph.cities[explanation.start].name;
  const goalName = romaniaGraph.cities[explanation.goal].name;
  const step = explanation.steps[stepIndex];
  const isLastStep = stepIndex === explanation.steps.length - 1;

  return (
    <div className={styles.content}>
      <p className={styles.routeLine}>
        {startName} → {goalName}
      </p>

      <div className={styles.controls}>
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => onStepIndexChange(stepIndex - 1)}
        >
          ← Previous
        </button>
        <span className={styles.stepLabel}>
          Column {step.pivot_column + 1} of {explanation.steps.length}
        </span>
        <button
          type="button"
          disabled={stepIndex === explanation.steps.length - 1}
          onClick={() => onStepIndexChange(stepIndex + 1)}
        >
          Next →
        </button>
      </div>

      <p className={styles.hint}>
        Pivoting on column {step.pivot_column}, row {step.pivot_row}. The left half is the
        (partially) reduced Laplacian; the right half accumulates its inverse.
      </p>

      <div className={styles.matrixScroll}>
        <table className={styles.matrixTable}>
          <tbody>
            {step.matrix_after.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === step.pivot_row ? styles.pivotRow : ""}>
                {row.map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className={colIndex === step.pivot_column ? styles.pivotColumn : ""}
                  >
                    {value.toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLastStep && (
        <p className={styles.result}>
          Final effective resistance ({startName} → {goalName}):{" "}
          <strong>{explanation.effective_resistance.toFixed(4)}</strong>
        </p>
      )}
    </div>
  );
}