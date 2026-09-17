"use client";

import CircuitMap from "../../components/circuit/CircuitMap";
import type { CircuitMarker } from "../../components/circuit/CircuitMap";
import CalculationPage from "../../components/heuristic/CalculationPage";
import { computeViewBox } from "../../components/heuristic/RouteMap";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import styles from "../heuristic-steps/page.module.css";

const name = (cityId: number) => romaniaGraph.cities[cityId].name;

export default function CircuitFlowPage() {
  return <CalculationPage current="circuit" title="The road network as a circuit" intro="See how current flows from the selected city to the destination before building the equations.">{(explanation) => <CircuitView explanation={explanation} />}</CalculationPage>;
}

function CircuitView({ explanation }: { explanation: HeuristicExplanation }) {
  const system = buildGroundedKirchhoffSystem(explanation);
  const startName = romaniaGraph.cities[explanation.start].name;
  const goalName = romaniaGraph.cities[explanation.goal].name;
  const potential: Record<number, number> = { [explanation.goal]: 0 };
  system.cityIds.forEach((cityId, index) => { potential[cityId] = system.voltage[index]; });
  const markers: CircuitMarker[] = romaniaGraph.cities.slice(0, explanation.laplacian.length).map((city) => ({
    cityId: city.id,
    role: city.id === explanation.goal ? "goal" : city.id === explanation.start ? "focus" : "path",
  }));
  const currentEdges = new Set(explanation.conductances.filter((edge) =>
    Math.abs((potential[edge.city_a] - potential[edge.city_b]) * edge.conductance) > 0.000001,
  ).map((edge) => `${Math.min(edge.city_a, edge.city_b)}-${Math.max(edge.city_a, edge.city_b)}`));
  const sameCity = explanation.start === explanation.goal;
  const exampleRoad = explanation.conductances.find((edge) =>
    edge.city_a === explanation.start || edge.city_b === explanation.start,
  );
  const exampleCurrent = exampleRoad
    ? exampleRoad.conductance * Math.abs(potential[exampleRoad.city_a] - potential[exampleRoad.city_b])
    : 0;

  return <article className={styles.content}>
    <section className={styles.lesson} aria-labelledby="circuit-title">
      <h2 id="circuit-title">{startName} → {goalName}</h2>
      <p>{sameCity ? "The selected city is already the destination. No current is injected and h(n) = 0." : `Inject 1 A at ${startName} and set ${goalName} to 0 V. Current splits across the connected road network. It does not follow only the shortest route.`}</p>
      {exampleRoad && <div className={styles.formulaList} role="math" aria-label="Road cost, conductance, and current formulas">
        <p className={styles.equation}>R<sub>{name(exampleRoad.city_a)},{name(exampleRoad.city_b)}</sub> = w<sub>{name(exampleRoad.city_a)},{name(exampleRoad.city_b)}</sub> = {exampleRoad.distance} Ω</p>
        <p className={styles.equation}>c<sub>{name(exampleRoad.city_a)},{name(exampleRoad.city_b)}</sub> = 1 ÷ R = 1 ÷ {exampleRoad.distance} = {exampleRoad.conductance.toFixed(6)} Ω<sup>−1</sup></p>
        <p className={styles.equation}>|I<sub>{name(exampleRoad.city_a)},{name(exampleRoad.city_b)}</sub>| = c|V<sub>i</sub> − V<sub>j</sub>| = {exampleRoad.conductance.toFixed(6)} × {Math.abs(potential[exampleRoad.city_a] - potential[exampleRoad.city_b]).toFixed(4)} = {exampleCurrent.toFixed(6)} A</p>
      </div>}
      <CircuitMap viewBox={computeViewBox(markers.map((marker) => marker.cityId), 80)} edges={explanation.conductances} potential={potential} markers={markers} hotEdges={currentEdges} />
      <p>Each resistor represents a road: its resistance in ohms equals its distance in kilometres. The arrows show current from higher to lower voltage; highlighted roads carry current.</p>
    </section>
    <section className={styles.lesson} aria-labelledby="circuit-result">
      <h2 id="circuit-result">The voltage becomes the estimate</h2>
      <p className={styles.equation} role="math">{sameCity ? `h(${startName}) = 0` : `h(${startName}) = R_eff(${startName}, ${goalName}) = ${explanation.effective_resistance.toFixed(4)} V ÷ 1 A = ${explanation.effective_resistance.toFixed(4)} Ω`}</p>
      <p>Using road kilometres as resistance makes this number the remaining-cost estimate. Continue to the Kirchhoff matrix to see the conductances and equations behind it.</p>
    </section>
  </article>;
}
