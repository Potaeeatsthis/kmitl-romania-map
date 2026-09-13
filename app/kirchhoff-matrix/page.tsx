"use client";

import Link from "next/link";
import { useState } from "react";
import CalculationPage from "../../components/heuristic/CalculationPage";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import styles from "../heuristic-steps/page.module.css";

const name = (id: number) => romaniaGraph.cities[id].name;
const number = (value: number) => value === 0 ? "0" : value.toFixed(6);

export default function KirchhoffMatrixPage() {
  return <CalculationPage current="kirchhoff-matrix" title="Build the Kirchhoff matrix" intro="Every matrix entry comes from a road. Follow one city’s current balance, then assemble the equations we solve for voltage.">{(explanation) => <KirchhoffView explanation={explanation} />}</CalculationPage>;
}

function KirchhoffView({ explanation }: { explanation: HeuristicExplanation }) {
  const [selectedCity, setSelectedCity] = useState(explanation.start);
  const [grounded, setGrounded] = useState(false);
  const system = buildGroundedKirchhoffSystem(explanation);
  const cityIds = grounded ? system.cityIds : romaniaGraph.cities.map((city) => city.id);
  const matrix = grounded ? system.matrix : explanation.laplacian;
  const roads = explanation.conductances.filter((edge) => edge.city_a === selectedCity || edge.city_b === selectedCity);
  const trivial = explanation.start === explanation.goal;
  const current = trivial ? 0 : selectedCity === explanation.start ? 1 : selectedCity === explanation.goal ? -1 : 0;
  const query = `?start=${explanation.start}&goal=${explanation.goal}`;

  return <article className={styles.content}>
    <section className={styles.lesson} aria-labelledby="one-city-title">
      <h2 id="one-city-title">1. Write the current balance for one city</h2>
      <p>For {name(explanation.start)} → {name(explanation.goal)}, imagine each road as a resistor: its distance is R, and its conductance is G = 1/R. Current on a road is G × (voltage here − voltage there).</p>
      <label className={styles.field}>Explore a city
        <select value={selectedCity} onChange={(event) => setSelectedCity(Number(event.target.value))}>
          {romaniaGraph.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
        </select>
      </label>
      <div className={styles.matrixScroll} role="region" aria-label="Road conductances" tabIndex={0}>
        <table className={styles.lessonTable}>
          <caption>Roads connected to {name(selectedCity)}</caption>
          <thead><tr><th scope="col">Road to</th><th scope="col">Distance → R</th><th scope="col">G = 1/R</th><th scope="col">Entry in this row</th></tr></thead>
          <tbody>{roads.map((road) => {
            const neighbor = road.city_a === selectedCity ? road.city_b : road.city_a;
            return <tr key={neighbor}><th scope="row">{name(neighbor)}</th><td>{road.distance} km → {road.distance} Ω</td><td>1/{road.distance} = {number(road.conductance)}</td><td>−{number(road.conductance)}</td></tr>;
          })}</tbody>
        </table>
      </div>
      <p className={styles.equation}>{roads.map((road) => `(V(${name(selectedCity)}) − V(${name(road.city_a === selectedCity ? road.city_b : road.city_a)})) / ${road.distance}`).join(" + ")} = {current} A</p>
      <p>The right-hand side is {current} A{trivial ? " because the start is already the destination; no current is needed." : selectedCity === explanation.start ? " because this is where we inject current." : selectedCity === explanation.goal ? " because this is where the injected current leaves the network." : " because this city only passes current along."}</p>
    </section>

    <section className={styles.lesson} aria-labelledby="entries-title">
      <h2 id="entries-title">2. Collect the voltage coefficients into a row</h2>
      <p>Expand the equation above. Every term containing V({name(selectedCity)}) contributes to the diagonal; each neighbor contributes a negative coefficient.</p>
      <dl className={styles.matrixGuide}>
        <div><dt>Same city · diagonal</dt><dd>{roads.map((road) => `1/${road.distance}`).join(" + ")} = <strong>{number(explanation.laplacian[selectedCity][selectedCity])}</strong></dd></div>
        <div><dt>Connected city</dt><dd>Use −1/R in that neighbor’s column.</dd></div>
        <div><dt>No direct road</dt><dd>Use 0. There is no direct current term.</dd></div>
      </dl>
      <p>Repeat for all 20 cities to form L. The full matrix is symmetric, and each row sums to zero: its positive diagonal balances its negative road entries.</p>
    </section>

    <section className={styles.lesson} aria-labelledby="ground-title">
      <h2 id="ground-title">3. Fix {name(explanation.goal)} at 0 V</h2>
      <p>Only voltage differences matter. Choosing the destination as ground gives us a fixed reference, so we can solve for the other 19 voltages. Remove its row and column to get L<sub>g</sub>.</p>
      <p><strong>Keep the original diagonal sums.</strong> Roads to {name(explanation.goal)} still carry current. Their neighbor-voltage terms disappear because V({name(explanation.goal)}) = 0; their diagonal contributions stay.</p>
      <div className={styles.viewControls} role="group" aria-label="Matrix form">
        <button type="button" aria-pressed={!grounded} onClick={() => setGrounded(false)}>Full L · 20 × 20</button>
        <button type="button" aria-pressed={grounded} onClick={() => setGrounded(true)}>Grounded Lg · 19 × 19</button>
      </div>
      <p>{grounded ? `Grounded matrix: ${name(explanation.goal)} is excluded.` : "Full matrix: all cities are included."} The selected city’s row is highlighted. Values are rounded to six decimal places.</p>
      {grounded && selectedCity === explanation.goal && <p role="status">The selected city is the ground, so its row and column have been removed.</p>}
      <div className={styles.matrixScroll} role="region" aria-label="Scrollable Kirchhoff matrix" tabIndex={0}>
        <table className={styles.matrixTable}>
          <caption className={styles.srOnly}>{grounded ? "Grounded" : "Full"} Kirchhoff matrix; conductance coefficients</caption>
          <thead><tr><th scope="col" className={styles.cornerCell}>City</th>{cityIds.map((id) => <th key={id} scope="col"><abbr title={name(id)}>{name(id).slice(0, 3)}</abbr></th>)}</tr></thead>
          <tbody>{matrix.map((row, index) => <tr key={cityIds[index]}>
            <th scope="row" className={cityIds[index] === selectedCity ? styles.pivotRowHeader : undefined}>{name(cityIds[index])}</th>
            {row.map((value, column) => <td key={cityIds[column]} className={cityIds[index] === selectedCity ? styles.pivotRowCell : undefined} title={`${name(cityIds[index])}, ${name(cityIds[column])}: ${value}`}>{number(value)}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      <p>Scroll horizontally to see every column. A grounded row can sum to a positive value when it has a road to the removed destination.</p>
    </section>

    <section className={styles.lesson} aria-labelledby="ready-title">
      <h2 id="ready-title">4. The matrix is ready. Now solve L<sub>g</sub>V = I.</h2>
      <p>{trivial ? "The start and destination are the same, so h(n) = 0 and no solve is needed." : `The current vector I has a 1 at ${name(explanation.start)} and 0 at every other remaining city. Solving gives each city’s voltage. The start voltage is the effective resistance because we injected exactly 1 A.`}</p>
      <nav className={styles.nav} aria-label="Continue calculation"><Link href={`/heuristic-summary${query}`}>Back to how it’s calculated</Link><Link href={`/heuristic-steps${query}`}>Next: matrix elimination →</Link></nav>
    </section>
  </article>;
}
