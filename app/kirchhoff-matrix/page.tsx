//app/kirchhoff-matrix/page.tsx
"use client";

import CalculationPage from "../../components/heuristic/CalculationPage";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import styles from "../heuristic-steps/page.module.css";

const name = (id: number) => romaniaGraph.cities[id].name;
const number = (value: number) => Math.abs(value) < 0.0000005 ? "0" : value.toFixed(6);

export default function KirchhoffMatrixPage() {
  return (
    <CalculationPage
      current="kirchhoff-matrix"
      title="Build the Kirchhoff matrix"
      intro="See only the selected h(n) pair first. Expand the full grounded matrix when you need the complete system."
    >
      {(explanation) => <KirchhoffView explanation={explanation} />}
    </CalculationPage>
  );
}

function KirchhoffView({ explanation }: { explanation: HeuristicExplanation }) {
  const system = buildGroundedKirchhoffSystem(explanation);
  const focusCityIds = [...new Set([explanation.start, explanation.goal])];
  const conductanceRows = focusCityIds.flatMap((cityId) =>
    explanation.conductances
      .filter((edge) => edge.city_a === cityId || edge.city_b === cityId)
      .map((edge) => ({
        cityId,
        neighborId: edge.city_a === cityId ? edge.city_b : edge.city_a,
        distance: edge.distance,
        conductance: edge.conductance,
      })),
  );

  return (
    <article className={styles.content}>
      <section className={styles.lesson} aria-labelledby="focused-conductance-title">
        <p className={styles.routeLine}>{name(explanation.start)} → {name(explanation.goal)}</p>
        <h2 id="focused-conductance-title">Conductance used by this h(n)</h2>
        <p>Road distance is resistance R. Each connected road contributes conductance G = 1/R to its city’s Kirchhoff row.</p>
        <div className={styles.formulaList} role="math" aria-label="Conductance formulas">
          <p className={styles.equation}>c<sub>ij</sub> = 1 ÷ w<sub>ij</sub></p>
          {conductanceRows[0] && <p className={styles.equation}>c<sub>{name(conductanceRows[0].cityId)},{name(conductanceRows[0].neighborId)}</sub> = 1 ÷ {conductanceRows[0].distance} = {number(conductanceRows[0].conductance)}</p>}
        </div>
        <div className={styles.matrixScroll} role="region" aria-label="Selected city conductances" tabIndex={0}>
          <table className={styles.lessonTable}>
            <caption>Roads connected to {focusCityIds.map(name).join(" and ")}</caption>
            <thead>
              <tr><th scope="col">Matrix row</th><th scope="col">Road to</th><th scope="col">Resistance R</th><th scope="col">Conductance G = 1/R</th><th scope="col">Off-diagonal entry</th></tr>
            </thead>
            <tbody>
              {conductanceRows.map((row) => (
                <tr key={`${row.cityId}-${row.neighborId}`}>
                  <th scope="row">{name(row.cityId)}</th>
                  <td>{name(row.neighborId)}</td>
                  <td>{row.distance} Ω</td>
                  <td>1/{row.distance} = {number(row.conductance)}</td>
                  <td>−{number(row.conductance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.lesson} aria-labelledby="focused-rows-title">
        <h2 id="focused-rows-title">Highlighted Kirchhoff rows</h2>
        <p>The diagonal is the sum of the city’s conductances. A connected city gets −G; every other column is 0.</p>
        <div className={styles.formulaList} role="math" aria-label="Kirchhoff matrix formulas">
          <p className={styles.equation}>K<sub>ii</sub> = Σ<sub>j</sub> c<sub>ij</sub></p>
          <p className={styles.equation}>K<sub>ij</sub> = −c<sub>ij</sub> when i and j are connected; otherwise K<sub>ij</sub> = 0</p>
        </div>
        <div className={styles.matrixScroll} role="region" aria-label="Selected Kirchhoff rows" tabIndex={0}>
          <table className={styles.matrixTable}>
            <caption className={styles.srOnly}>Kirchhoff rows for {focusCityIds.map(name).join(" and ")}</caption>
            <thead><tr><th scope="col" className={styles.cornerCell}>City</th>{romaniaGraph.cities.slice(0, explanation.laplacian.length).map((city) => <th key={city.id} scope="col"><abbr title={city.name}>{city.name.slice(0, 3)}</abbr></th>)}</tr></thead>
            <tbody>
              {focusCityIds.map((cityId) => (
                <tr key={cityId}>
                  <th scope="row" className={styles.pivotRowHeader}>{name(cityId)}</th>
                  {explanation.laplacian[cityId].map((value, column) => <td key={column} className={styles.pivotRowCell} title={`${name(cityId)}, ${name(column)}: ${value}`}>{number(value)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {focusCityIds.map((cityId) => {
          const roads = conductanceRows.filter((row) => row.cityId === cityId);
          return <p key={cityId} className={styles.equation}>K({name(cityId)}, {name(cityId)}) = {roads.map((road) => `1/${road.distance}`).join(" + ")} = {number(explanation.laplacian[cityId][cityId])}</p>;
        })}
        <p>{name(explanation.goal)} is then grounded at 0 V, so its row and column are removed before elimination. Its road conductances remain in neighboring diagonal sums.</p>
        <div className={styles.formulaList} role="math" aria-label="Grounded Kirchhoff system formulas">
          <p className={styles.equation}>V<sub>{name(explanation.goal)}</sub> = 0</p>
          <p className={styles.equation}>K<sub>g</sub> = K without the {name(explanation.goal)} row and column</p>
          <p className={styles.equation}>K<sub>g</sub>V = I<sub>{name(explanation.start)}</sub></p>
        </div>
      </section>

      <details className={styles.matrixDetails}>
        <summary>Show the full grounded matrix · {system.cityIds.length} × {system.cityIds.length}</summary>
        <p>The full network is still required because intermediate cities affect the effective resistance.</p>
        <div className={styles.matrixScroll} role="region" aria-label="Full grounded Kirchhoff matrix" tabIndex={0}>
          <table className={styles.matrixTable}>
            <caption className={styles.srOnly}>Full grounded Kirchhoff matrix excluding {name(explanation.goal)}</caption>
            <thead><tr><th scope="col" className={styles.cornerCell}>City</th>{system.cityIds.map((id) => <th key={id} scope="col"><abbr title={name(id)}>{name(id).slice(0, 3)}</abbr></th>)}</tr></thead>
            <tbody>{system.matrix.map((row, rowIndex) => <tr key={system.cityIds[rowIndex]}>
              <th scope="row" className={system.cityIds[rowIndex] === explanation.start ? styles.pivotRowHeader : undefined}>{name(system.cityIds[rowIndex])}</th>
              {row.map((value, column) => <td key={system.cityIds[column]} className={system.cityIds[rowIndex] === explanation.start ? styles.pivotRowCell : undefined}>{number(value)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
