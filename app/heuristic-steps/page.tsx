// app/heuristic-steps/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import CalculationPage from "../../components/heuristic/CalculationPage";

import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import styles from "./page.module.css";

function shortCityName(cityId: number): string {
  return romaniaGraph.cities[cityId].name.slice(0, 3);
}

export default function HeuristicStepsPage() {
  return <CalculationPage current="heuristic-steps" title="Gauss–Jordan matrix elimination" intro="Separate the city voltages one column at a time, then read the value A* uses as its estimate.">{(explanation) => <StepsView explanation={explanation} />}</CalculationPage>;
}

function StepsView({ explanation }: { explanation: HeuristicExplanation }) {
  const params = useSearchParams();
  const showResult = params.get("view") === "result";
  const [stepIndex, onStepIndexChange] = useState(() => showResult ? Math.max(0, explanation.steps.length - 1) : 0);
  const answerRef = useRef<HTMLTableCellElement>(null);
  const [showBefore, setShowBefore] = useState(false);
  useEffect(() => {
    if (showResult && !showBefore && stepIndex === explanation.steps.length - 1) {
      answerRef.current?.scrollIntoView?.({ block: "center", inline: "center" });
    }
  }, [showResult, showBefore, stepIndex, explanation.steps.length]);
  const startName = romaniaGraph.cities[explanation.start].name;
  const goalName = romaniaGraph.cities[explanation.goal].name;
  const system = buildGroundedKirchhoffSystem(explanation);
  if (system.startIndex === null) {
    return <section className={styles.content}><div className={styles.lesson}><h2>No elimination needed</h2><p>{startName} is already the destination. No current is needed, so h({startName}) = 0.</p></div></section>;
  }
  const step = explanation.steps[stepIndex];
  const matrixSize = system.cityIds.length;
  const pivotCityId = system.cityIds[step.pivot_column];
  const pivotCityName = romaniaGraph.cities[pivotCityId].name;
  const isLastStep = stepIndex === explanation.steps.length - 1;


  const before = stepIndex === 0
    ? system.matrix.map((row, index) => [...row, ...system.cityIds.map((_, column) => Number(index === column))])
    : explanation.steps[stepIndex - 1].matrix_after;
  // Narrate the pivot choice only; numerical results remain the Rust trace.
  let selectedRow = step.pivot_column;
  for (let row = selectedRow + 1; row < matrixSize; row++) {
    if (Math.abs(before[row][step.pivot_column]) > Math.abs(before[selectedRow][step.pivot_column])) selectedRow = row;
  }
  const divisor = before[selectedRow][step.pivot_column];
  const displayedMatrix = showBefore ? before : step.matrix_after;
  const afterSwap = before.map((row) => [...row]);
  if (selectedRow !== step.pivot_row) {
    [afterSwap[selectedRow], afterSwap[step.pivot_row]] = [afterSwap[step.pivot_row], afterSwap[selectedRow]];
  }
  const eliminationRow = afterSwap.findIndex((row, rowIndex) =>
    rowIndex !== step.pivot_row && Math.abs(row[step.pivot_column]) > 1e-12,
  );
  const eliminationFactor = eliminationRow >= 0 ? afterSwap[eliminationRow][step.pivot_column] : 0;

  return (
    <div className={styles.content}>
      <section className={styles.lesson} aria-labelledby="elimination-purpose">
        <h2 id="elimination-purpose">What are we trying to do?</h2>
        <p>Each row of L<sub>g</sub>V = I is an equation containing several unknown city voltages. Elimination combines equivalent equations until each row isolates one voltage. A pivot is the entry we turn into 1; the other entries in its column become 0.</p>
        <p className={styles.equation}>[ L<sub>g</sub> | identity ] → [ identity | L<sub>g</sub><sup>−1</sup> ]</p>
        <p>The identity matrix has 1 on its diagonal and 0 elsewhere. Apply every row operation to both halves: when the left half becomes identity, the right half is the inverse, which converts injected currents into voltages.</p>
        <p><strong>Two different meanings:</strong> I in L<sub>g</sub>V = I is the current vector. “Identity” above means a square matrix, not injected current.</p>
      </section>
      <section className={styles.stepPanel} aria-labelledby="current-pivot-title">
        <div className={styles.stepCopy}>
          <p className={styles.routeLine}>{startName} → {goalName}</p>
          <h2 id="current-pivot-title">Pivot the {pivotCityName} column</h2>
          <p>
            Make one entry in the {pivotCityName} column equal 1 and all the others equal 0.
            The destination {goalName} is already removed because it is grounded at 0 V.
          </p>
        </div>

        <div className={styles.stepControls}>
          <div className={styles.controls}>
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={() => onStepIndexChange(stepIndex - 1)}
            >
              ← Previous pivot
            </button>
            <span className={styles.stepLabel} aria-live="polite">
              Pivot {stepIndex + 1} of {explanation.steps.length}
            </span>
            <button
              type="button"
              disabled={isLastStep}
              onClick={() => onStepIndexChange(stepIndex + 1)}
            >
              Next pivot →
            </button>
          </div>
          <progress
            className={styles.progress}
            value={stepIndex + 1}
            max={explanation.steps.length}
            aria-label={`Elimination progress: pivot ${stepIndex + 1} of ${explanation.steps.length}`}
          />
        </div>
      </section>


      <section className={styles.lesson} aria-labelledby="operation-title">
        <h2 id="operation-title">What happens in pivot {stepIndex + 1}?</h2>
        <ol className={styles.operations}>
          <li><strong>Choose a stable pivot.</strong> {selectedRow === step.pivot_row ? `Row ${selectedRow + 1} already has the largest absolute entry among the remaining rows; no swap is needed.` : `Swap row ${selectedRow + 1} with row ${step.pivot_row + 1} to use the largest absolute entry among the remaining rows.`}</li>
          <li><strong>Make the pivot 1.</strong> Divide every entry in row {step.pivot_row + 1}, on both halves, by {divisor.toPrecision(6)}. The pivot becomes {divisor.toPrecision(6)} ÷ {divisor.toPrecision(6)} = 1.</li>
          <li><strong>Clear the rest of the column.</strong> For each other row, subtract its entry in this column × the normalized pivot row. An entry a becomes a − a × 1 = 0. A row already containing 0 needs no change.</li>
        </ol>
        <div className={styles.formulaList} role="math" aria-label={`Pivot ${stepIndex + 1} formulas`}>
          <p className={styles.equation}>p = arg max<sub>r ≥ {step.pivot_column + 1}</sub> |A<sub>r,{step.pivot_column + 1}</sub>| = r{selectedRow + 1}</p>
          {selectedRow !== step.pivot_row && <p className={styles.equation}>R<sub>{step.pivot_row + 1}</sub> ↔ R<sub>{selectedRow + 1}</sub></p>}
          <p className={styles.equation}>R<sub>{step.pivot_row + 1}</sub> ← R<sub>{step.pivot_row + 1}</sub> ÷ {divisor.toPrecision(6)}</p>
          {eliminationRow >= 0 && <p className={styles.equation}>R<sub>{eliminationRow + 1}</sub> ← R<sub>{eliminationRow + 1}</sub> − ({eliminationFactor.toPrecision(6)})R<sub>{step.pivot_row + 1}</sub>; {eliminationFactor.toPrecision(6)} − ({eliminationFactor.toPrecision(6)} × 1) = 0</p>}
        </div>
        <div className={styles.matrixScroll} role="region" aria-label="Pivot column before and after" tabIndex={0}>
          <table className={styles.lessonTable}>
            <caption>{pivotCityName} column · before and after all three operations</caption>
            <thead><tr><th scope="col">Row position</th><th scope="col">Before</th><th scope="col">After</th><th scope="col">Outcome</th></tr></thead>
            <tbody>{before.map((row, index) => <tr key={index}><th scope="row">r{index + 1}</th><td>{row[step.pivot_column].toFixed(6)}</td><td>{step.matrix_after[index][step.pivot_column].toFixed(6)}</td><td>{index === step.pivot_row ? "Pivot becomes 1" : "Column entry is 0"}</td></tr>)}</tbody>
          </table>
        </div>
        <p>Rows are equation positions, not permanent city labels: a swap moves an entire equation. Column labels still identify the city voltages.</p>
        <div className={styles.viewControls}><button type="button" onClick={() => { onStepIndexChange(explanation.steps.length - 1); setShowBefore(false); }}>Skip to the finished inverse</button></div>
      </section>

      <details className={styles.matrixDetails} open={showResult || undefined}>
      <summary>Inspect the full augmented matrix · {matrixSize} × {matrixSize * 2}</summary>
      <dl className={styles.matrixGuide}>
        <div>
          <dt>Left half</dt>
          <dd>L<sub>g</sub> is reduced toward identity.</dd>
        </div>
        <div>
          <dt>Right half</dt>
          <dd>The same row operations build L<sub>g</sub><sup>−1</sup>.</dd>
        </div>
        <div>
          <dt>Highlighted cross</dt>
          <dd>The active pivot row and city column.</dd>
        </div>
      </dl>

      <div className={styles.viewControls} role="group" aria-label="Elimination matrix snapshot">
        <button type="button" aria-pressed={showBefore} onClick={() => setShowBefore(true)}>Before this pivot</button>
        <button type="button" aria-pressed={!showBefore} onClick={() => setShowBefore(false)}>After this pivot</button>
      </div>
      <div
        className={styles.matrixScroll}
        role="region"
        aria-label="Scrollable augmented elimination matrix"
        tabIndex={0}
      >
        <table className={styles.matrixTable}>
          <caption className={styles.srOnly}>
            {showBefore ? "Before" : "After"} Gauss-Jordan pivot {stepIndex + 1}. Left half reduces the grounded Kirchhoff matrix;
            right half builds its inverse.
          </caption>
          <thead>
            <tr>
              <th className={styles.cornerCell} rowSpan={2} scope="col">row</th>
              <th colSpan={matrixSize} scope="colgroup">Reducing L<sub>g</sub> → identity</th>
              <th className={styles.inverseGroup} colSpan={matrixSize} scope="colgroup">
                Building L<sub>g</sub><sup>−1</sup>
              </th>
            </tr>
            <tr>
              {system.cityIds.map((cityId) => (
                <th
                  key={`left-${cityId}`}
                  className={cityId === pivotCityId ? styles.pivotColumnHeader : undefined}
                  scope="col"
                >
                  <abbr title={romaniaGraph.cities[cityId].name} aria-label={romaniaGraph.cities[cityId].name}>
                    {shortCityName(cityId)}
                  </abbr>
                </th>
              ))}
              {system.cityIds.map((cityId) => (
                <th
                  key={`right-${cityId}`}
                  className={cityId === explanation.start && isLastStep && !showBefore ? styles.answerHeader : undefined}
                  scope="col"
                >
                  <abbr title={romaniaGraph.cities[cityId].name} aria-label={romaniaGraph.cities[cityId].name}>
                    {shortCityName(cityId)}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedMatrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  className={rowIndex === step.pivot_row ? styles.pivotRowHeader : undefined}
                  scope="row"
                >
                  r{rowIndex + 1}
                </th>
                {row.map((value, columnIndex) => {
                  const isPivotRow = rowIndex === step.pivot_row;
                  const isPivotColumn = columnIndex === step.pivot_column;
                  const isAnswer =
                    isLastStep && !showBefore &&
                    system.startIndex !== null &&
                    rowIndex === system.startIndex &&
                    columnIndex === matrixSize + system.startIndex;
                  const classes = [styles.matrixCell];
                  if (columnIndex === matrixSize) classes.push(styles.inverseStartCell);
                  if (isPivotRow) classes.push(styles.pivotRowCell);
                  if (isPivotColumn) classes.push(styles.pivotColumnCell);
                  if (isPivotRow && isPivotColumn) classes.push(styles.pivotCell);
                  if (isAnswer) classes.push(styles.answerCell);

                  return (
                    <td key={columnIndex} className={classes.join(" ")} ref={isAnswer ? answerRef : undefined} aria-label={isAnswer ? `Selected h(${startName} → ${goalName}): ${value.toFixed(2)}` : undefined}>
                      {isAnswer ? <mark className={styles.valueHighlight} title={value.toPrecision(12)}>{value.toFixed(2)}</mark> : Math.abs(value) < 0.0005 ? "0" : value.toFixed(3)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.scrollHint}>Scroll horizontally to inspect both halves of the matrix.</p>


      </details>
      <section className={styles.lesson} aria-labelledby="read-answer-title">
        <h2 id="read-answer-title">How does the final matrix become h(n)?</h2>
        {system.startIndex === null ? <p>{startName} is already the destination. No current is needed, so h({startName}) = 0.</p> : <>
          <p>Once all {matrixSize} pivots are done, multiply the inverse by the current vector. That vector contains just one 1, at {startName}; every other entry is 0.</p>
          <div className={styles.formulaList} role="math" aria-label="Effective resistance formulas">
            <p className={styles.equation}>V = L<sub>g</sub><sup>−1</sup>I<sub>{startName}</sub></p>
            <p className={styles.equation}>h({startName}) = R<sub>eff</sub>({startName}, {goalName}) = [L<sub>g</sub><sup>−1</sup>]<sub>{startName},{startName}</sub> = {explanation.effective_resistance.toFixed(4)}</p>
          </div>
          <ol className={styles.operations}>
            <li><strong>Pick the {startName} column in the right half.</strong> Multiplying by I selects this entire column because all the other columns are multiplied by 0. It gives every city’s voltage for 1 A injected at {startName}.</li>
            <li><strong>Find the {startName} row in that column.</strong> Row {system.startIndex + 1}, column {system.startIndex + 1} of the finished inverse gives V({startName}) = {system.voltage[system.startIndex].toFixed(4)} V, measured relative to {goalName} at 0 V.</li>
            <li><strong>Use resistance = voltage ÷ current.</strong> R<sub>eff</sub> = {system.voltage[system.startIndex].toFixed(4)} V ÷ 1 A = {explanation.effective_resistance.toFixed(4)} Ω. With road kilometres represented as ohms, that number becomes h({startName}), the remaining-cost estimate in km.</li>
          </ol>
          <p>Other entries in this column are voltages for this same current injection. To find another city’s own h(n), use that city’s diagonal entry in the final inverse—the value for injecting 1 A at that city instead.</p>
        </>}
      </section>
      {isLastStep && (
        <section className={styles.result} aria-labelledby="elimination-result-title">
          <div>
            <h2 id="elimination-result-title">Inverse complete</h2>
            <p>
              {system.startIndex === null ? "Start and destination are identical, so the heuristic is zero." : `The ${startName} diagonal entry in the right half becomes h(${startName}), the estimate A* adds to the distance already travelled.`}
            </p>
          </div>
          <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>
        </section>
      )}
    </div>
  );
}
