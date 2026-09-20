// app/circuit-flow/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CalculationPage from "../../components/heuristic/CalculationPage";
import CircuitMap from "../../components/circuit/CircuitMap";
import type { CircuitMarker } from "../../components/circuit/CircuitMap";
import CircuitLegend from "../../components/circuit/CircuitLegend";
import { CircuitMotionControl, CircuitMotionProvider } from "../../components/circuit/CircuitMotion";
import {
  VoltageBarChart,
  CircuitSchematic,
  SchematicGrid,
  CandidateBarChart,
  KclBalanceScale,
} from "../../components/circuit/CalculationVisuals";
import { computeViewBox } from "../../components/heuristic/RouteMap";
import { buildExpansionView, edgeKey } from "../../lib/expansionView";
import { buildGroundedKirchhoffSystem, carriesCurrent } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation, SearchResponse, SearchStep } from "../../lib/types";
import { runSearch } from "../../lib/wasm/client";
import styles from "./calculation.module.css";

function findStepIndex(trace: SearchStep[], cityId: number): number {
  return trace.findIndex((step) => step.expanded_city === cityId);
}

function abbr(name: string): string {
  return name.slice(0, 3);
}

/**
 * Renders a 2D array as a real bracket-matrix -- [ ... ] drawn with CSS
 * borders on either side of a scrollable table, the way the worked-example
 * document writes L, L+, and the augmented system.
 */
function MatrixBracket({
  rows,
  rowLabels,
  colLabels,
  highlightCol,
  highlightRow,
  dividerAfterCol,
  precision = 4,
}: {
  rows: number[][];
  rowLabels?: string[];
  colLabels?: string[];
  highlightCol?: number;
  highlightRow?: number;
  dividerAfterCol?: number;
  precision?: number;
}) {
  return (
    <div className={styles.matrixBracketOuter}>
      <div className={styles.matrixBracketScroll}>
        <table className={styles.bracketTable}>
          {colLabels && (
            <thead>
              <tr>
                {rowLabels && <th />}
                {colLabels.map((label, colIndex) => (
                  <th
                    key={colIndex}
                    className={[
                      colIndex === highlightCol ? styles.matrixHighlightLabel : "",
                      dividerAfterCol !== undefined && colIndex === dividerAfterCol
                        ? styles.matrixDividerAfter
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {rowLabels && (
                  <th className={rowIndex === highlightRow ? styles.matrixHighlightLabel : ""}>
                    {rowLabels[rowIndex]}
                  </th>
                )}
                {row.map((value, colIndex) => (
                  <td
                    key={colIndex}
                    className={[
                      rowIndex === colIndex && dividerAfterCol === undefined ? styles.diagCell : "",
                      colIndex === highlightCol ? styles.matrixHighlightCol : "",
                      rowIndex === highlightRow ? styles.matrixHighlightRow : "",
                      dividerAfterCol !== undefined && colIndex === dividerAfterCol
                        ? styles.matrixDividerAfter
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {value.toFixed(precision)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CircuitFlowPage() {
  return (
    <CircuitMotionProvider>
      <CalculationPage
        current="circuit"
        title="The road network as a circuit"
        intro="Turn roads into a circuit, solve for voltages, and see how the results help A* find a route."
      >
        {(explanation, query) => <CircuitView explanation={explanation} query={query} />}
      </CalculationPage>
    </CircuitMotionProvider>
  );
}

type Edge = { neighborId: number; distance: number; conductance: number };

function CircuitView({ explanation, query }: { explanation: HeuristicExplanation; query: string }) {
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSearch(null);
    setSearchError(null);
    runSearch(explanation.start, explanation.goal)
      .then((result) => {
        if (!cancelled) setSearch(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSearchError(error instanceof Error ? error.message : "Unknown error");
      });
    return () => {
      cancelled = true;
    };
  }, [explanation.start, explanation.goal]);

  const startName = romaniaGraph.cities[explanation.start].name;
  const goalName = romaniaGraph.cities[explanation.goal].name;
  const sameCity = explanation.start === explanation.goal;

  const system = buildGroundedKirchhoffSystem(explanation);
  const potential: Record<number, number> = { [explanation.goal]: 0 };
  system.cityIds.forEach((cityId, index) => {
    potential[cityId] = system.voltage[index];
  });

  const cityCount = explanation.laplacian.length;
  const edgesByCity = new Map<number, Edge[]>();
  for (const edge of explanation.conductances) {
    if (!edgesByCity.has(edge.city_a)) edgesByCity.set(edge.city_a, []);
    if (!edgesByCity.has(edge.city_b)) edgesByCity.set(edge.city_b, []);
    edgesByCity.get(edge.city_a)!.push({
      neighborId: edge.city_b,
      distance: edge.distance,
      conductance: edge.conductance,
    });
    edgesByCity.get(edge.city_b)!.push({
      neighborId: edge.city_a,
      distance: edge.distance,
      conductance: edge.conductance,
    });
  }

  if (sameCity) {
    const exampleRoad = explanation.conductances.find(
      (edge) => edge.city_a === explanation.start || edge.city_b === explanation.start,
    );
    return (
      <article className={styles.content}>
        <section className={styles.card}>
          <p className={styles.narrative}>
            {startName} is already the destination. No current is injected, so h({startName}) = 0.
          </p>
          {exampleRoad && (
            <div className={styles.formulaList} role="math" aria-label="Road cost, conductance, and current formulas">
              <p className={styles.equation}>
                R<sub>{romaniaGraph.cities[exampleRoad.city_a].name}</sub>,
                <sub>{romaniaGraph.cities[exampleRoad.city_b].name}</sub> ={" "}
                w<sub>{romaniaGraph.cities[exampleRoad.city_a].name}</sub>,
                <sub>{romaniaGraph.cities[exampleRoad.city_b].name}</sub> = {exampleRoad.distance} Ω
              </p>
              <p className={styles.equation}>
                c<sub>{romaniaGraph.cities[exampleRoad.city_a].name}</sub>,
                <sub>{romaniaGraph.cities[exampleRoad.city_b].name}</sub> = 1 ÷ R = 1 ÷{" "}
                {exampleRoad.distance} = {exampleRoad.conductance.toFixed(6)} Ω<sup>−1</sup>
              </p>
              <p className={styles.equation}>
                |I<sub>{romaniaGraph.cities[exampleRoad.city_a].name}</sub>,
                <sub>{romaniaGraph.cities[exampleRoad.city_b].name}</sub>| = c|V<sub>i</sub> − V<sub>j</sub>| ={" "}
                {exampleRoad.conductance.toFixed(6)} ×{" "}
                {Math.abs(
                  (potential[exampleRoad.city_a] ?? 0) - (potential[exampleRoad.city_b] ?? 0),
                ).toFixed(4)}{" "}
                ={" "}
                {(
                  exampleRoad.conductance *
                  Math.abs((potential[exampleRoad.city_a] ?? 0) - (potential[exampleRoad.city_b] ?? 0))
                ).toFixed(6)}{" "}
                A
              </p>
            </div>
          )}
          <div className={styles.kclFormula}>h({startName}) = 0</div>
        </section>
      </article>
    );
  }

  const finalStep = explanation.steps.at(-1);
  if (!finalStep || system.startIndex === null) {
    return (
      <article className={styles.content}>
        <section className={styles.card}>
          <p className={styles.errorText}>The elimination result is missing for this route.</p>
        </section>
      </article>
    );
  }

  const reducedN = system.cityIds.length;
  const reducedLabels = system.cityIds.map((id) => abbr(romaniaGraph.cities[id].name));

  // ---- worked derivation data for Step 2 ----
  const startNeighbors = (edgesByCity.get(explanation.start) ?? []).sort(
    (a, b) => a.neighborId - b.neighborId,
  );
  const startDiagonal = startNeighbors.reduce((sum, e) => sum + e.conductance, 0);

  // ---- full unreduced Kirchhoff matrix for Step 2's bracket matrix ----
  const fullLaplacianRows = romaniaGraph.cities.slice(0, cityCount).map((_, i) => explanation.laplacian[i]);
  const fullLabels = romaniaGraph.cities.slice(0, cityCount).map((c) => abbr(c.name));

  // ---- augmented system BEFORE elimination for Step 3, built straight
  // from system.matrix (the same grounded Kirchhoff matrix Rust reduced) ----
  const initialAugmented: number[][] = system.matrix.map((row, i) => [
    ...row,
    ...system.cityIds.map((_, j) => (i === j ? 1 : 0)),
  ]);
  const augmentedColLabels = [...reducedLabels, ...reducedLabels.map((l) => `I(${l})`)];
  const finalAugmentedRows = finalStep.matrix_after;

  // ---- search-dependent data (path + per-terminal trace) ----
  const path = search?.astar.path ?? [];
  const trace = search?.astar.trace ?? [];
  const nodesToAnalyze = path.filter((cityId) => cityId !== explanation.goal);

  const pathEdgeKeys = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    pathEdgeKeys.add(edgeKey(path[i], path[i + 1]));
  }

  const overviewMarkers: CircuitMarker[] = path.map((cityId) => ({
    cityId,
    role: cityId === explanation.start ? "focus" : cityId === explanation.goal ? "goal" : "path",
  }));

  return (
    <div className={styles.content}>
      <p className={styles.routeLine}>
        {startName} → {goalName}
      </p>

      <CircuitMotionControl />

      <section className={styles.card}>
        <p className={styles.narrative}>
          Imagine the roads are wires and the cities are junctions. We push{" "}
          <strong>1 amp of current</strong> in at <strong>{startName}</strong> and connect{" "}
          <strong>{goalName}</strong> straight to the ground (0 volts). The steps below show,
          number by number, how that current spreads out and settles — and why the result
          becomes A*&apos;s estimate of "how far is left to go."
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>1</span> Every road becomes a resistor
        </h2>
        <p className={styles.hint}>
          A modelling choice: each road&apos;s length in km is used as its resistance in ohms.
          This is not a real road resistance — we only want longer roads to resist more current,
          just like a longer drive takes more effort.
        </p>
        {startNeighbors[0] && (
          <CircuitSchematic
            fromLabel={startName}
            fromVoltage={potential[explanation.start] ?? 0}
            fromIsSource
            toLabel={romaniaGraph.cities[startNeighbors[0].neighborId].name}
            toVoltage={potential[startNeighbors[0].neighborId] ?? 0}
            toIsGround={startNeighbors[0].neighborId === explanation.goal}
            resistance={startNeighbors[0].distance}
            conductance={startNeighbors[0].conductance}
            current={
              startNeighbors[0].conductance *
              ((potential[explanation.start] ?? 0) - (potential[startNeighbors[0].neighborId] ?? 0))
            }
          />
        )}
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Resistor (road)</th>
                <th>R (Ω = km)</th>
                <th>c = 1/R (Ω⁻¹)</th>
              </tr>
            </thead>
            <tbody>
              {explanation.conductances.map((edge) => (
                <tr key={`${edge.city_a}-${edge.city_b}`}>
                  <td>
                    {romaniaGraph.cities[edge.city_a].name} — {romaniaGraph.cities[edge.city_b].name}
                  </td>
                  <td>{edge.distance}</td>
                  <td>{edge.conductance.toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>2</span> Build the circuit — the Kirchhoff matrix
        </h2>
        <p className={styles.hint}>
          This packs every road into one big table called the Kirchhoff matrix (the weighted
          graph Laplacian). Each city gets a row. On the diagonal, that row adds up all its own
          roads&apos; conductances. Off the diagonal, a directly connected city gets −c, and a
          city with no direct road gets 0.
        </p>

        <p className={styles.derivationLabel}>
          K({abbr(startName)}, {abbr(startName)}):
        </p>
        <div className={styles.derivationBlock}>
          {startNeighbors.map((edge, i) => (
            <p key={edge.neighborId} className={styles.derivationLine}>
              c({abbr(startName)}{abbr(romaniaGraph.cities[edge.neighborId].name)}) = 1/
              {edge.distance} = {edge.conductance.toFixed(6)}
              {i < startNeighbors.length - 1 ? "  +" : ""}
            </p>
          ))}
          <p className={styles.derivationResult}>
            K({abbr(startName)}, {abbr(startName)}) ={" "}
            {startNeighbors.map((e) => e.conductance.toFixed(6)).join(" + ")} ={" "}
            <strong>{startDiagonal.toFixed(6)}</strong>
          </p>
        </div>

        {startNeighbors[0] && (
          <>
            <p className={styles.derivationLabel}>
              K({abbr(startName)}, {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}):
            </p>
            <div className={styles.derivationBlock}>
              <p className={styles.derivationResult}>
                K({abbr(startName)}, {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}
                ) = −c({abbr(startName)}
                {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}) = −
                {startNeighbors[0].conductance.toFixed(6)}
              </p>
            </div>
          </>
        )}

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>
            Full {cityCount}×{cityCount} Kirchhoff matrix
          </summary>
          <MatrixBracket
            rows={fullLaplacianRows}
            rowLabels={fullLabels}
            colLabels={fullLabels}
            highlightRow={explanation.goal}
            highlightCol={explanation.goal}
            precision={3}
          />
        </details>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>3</span> Ground {goalName}, then solve for the voltages
        </h2>
        <p className={styles.hint}>
          Connecting {goalName} to the ground fixes it at 0 volts. In the table that means we
          delete {goalName}&apos;s row and its column, leaving a smaller table called{" "}
          <strong>K_grounded</strong>. Every other city keeps the conductances of the roads that
          touched {goalName} in its diagonal, so the rest of the network is unchanged.
        </p>
        <p className={styles.hint}>
          To solve it, we write K_grounded next to a helper table called the identity table I.
          I has 1s on its diagonal (top-left to bottom-right) and 0s everywhere else. Gauss-Jordan
          elimination then turns <strong>[K_grounded | I]</strong> into{" "}
          <strong>[I | K_grounded inverse]</strong>. The right half, the inverse, is the answer
          table: find the highlighted column for {startName} and read down it to get every
          city&apos;s voltage.
        </p>
        <p className={styles.hint}>
          The cell where {startName}&apos;s own row crosses the {startName} column is the{" "}
          <strong>source diagonal</strong>. That cell is h({startName}) — the effective
          resistance from {startName} to {goalName}. A different city&apos;s voltage in this
          column is only its voltage for this one source. That city&apos;s own h sits on its own
          row-and-column crossing, not here.
        </p>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>Before: [K_grounded | I]</summary>
          <MatrixBracket
            rows={initialAugmented}
            rowLabels={reducedLabels}
            colLabels={augmentedColLabels}
            highlightCol={system.startIndex}
            dividerAfterCol={reducedN - 1}
            precision={3}
          />
        </details>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>After: [I | K_grounded inverse]</summary>
          <MatrixBracket
            rows={finalAugmentedRows}
            rowLabels={reducedLabels}
            colLabels={augmentedColLabels}
            highlightCol={reducedN + system.startIndex}
            dividerAfterCol={reducedN - 1}
            precision={3}
          />
        </details>

        <p className={styles.hint}>
          <Link href={`/heuristic-steps${query}`}>
            Watch every pivot happen, one at a time →
          </Link>
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>4</span> Read off the effective resistance
        </h2>
        <p className={styles.hint}>
          The voltage left over at {startName} tells us the total resistance of the whole
          circuit. That number is the source diagonal of the inverse table, and it becomes the
          distance estimate h({startName}) that A* uses. Every other city also has a diagonal
          entry in that table — that entry is that city&apos;s own estimate to {goalName}, which
          is a different number from the voltage shown for it here.
        </p>
        <div className={styles.kclFormula}>
          h({startName}) = R<sub>eff</sub> = V<sub>{abbr(startName)}</sub> ÷ 1 A ={" "}
          <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>5</span> The solved circuit
        </h2>
        <p className={styles.hint}>
          The map below shows the solved circuit. Current can spread across the whole network,
          not just one route — and some roads carry no current at all. The highlighted edges are
          the final route A* chose from {startName} to {goalName}.
        </p>
        {searchError && (
          <p className={styles.errorText}>Could not load the A* search trace: {searchError}.</p>
        )}
        {!search && !searchError && <p className={styles.hint}>Loading…</p>}
        {search && (
          <>
            <CircuitLegend variant="overview" />
            <CircuitMap
              viewBox={computeViewBox(path, 80)}
              edges={explanation.conductances}
              potential={potential}
              markers={overviewMarkers}
              hotEdges={pathEdgeKeys}
            />
            <VoltageBarChart
              cities={path.map((cityId) => ({
                cityId,
                name: romaniaGraph.cities[cityId].name,
                voltage: potential[cityId] ?? 0,
                isGoal: cityId === explanation.goal,
                isStart: cityId === explanation.start,
              }))}
            />
          </>
        )}
      </section>

      {search && (
        <>
          <h2 className={styles.sectionDivider}>A closer look at each city on the route</h2>
          <p className={styles.dividerHint}>
            A* expands one city at a time from {startName} to {goalName}. At each step it looks
            at every city waiting in its queue and expands the one with the lowest{" "}
            <strong>f = g + h</strong>. Here g is the distance so far to that city, and h is the
            estimate of the distance still left to {goalName}. The winner is often not a
            neighbour of the city it just expanded.
          </p>

          {nodesToAnalyze.map((cityId, index) => {
            const isStart = cityId === explanation.start;
            const cityName = romaniaGraph.cities[cityId].name;
            const edges = (edgesByCity.get(cityId) ?? []).sort((a, b) => a.neighborId - b.neighborId);
            const neighborIds = new Set(edges.map((edge) => edge.neighborId));
            const v = potential[cityId] ?? 0;

            const stepIndex = findStepIndex(trace, cityId);
            const view = buildExpansionView(trace, stepIndex, cityId, neighborIds);
            const chosenNextId = view?.chosenNextId ?? null;
            const chosenIsAdjacent = view?.chosenIsAdjacent ?? false;
            const candidates = view?.candidates ?? [];
            const adjacentCandidates = view?.adjacent ?? [];
            const nonAdjacentCandidates = view?.nonAdjacent ?? [];
            const hotEdges = view?.hotEdges ?? new Set<string>();
            const consideredEdges = view?.consideredEdges ?? new Set<string>();

            // A city's own h is its diagonal in the inverse grounded matrix --
            // NOT the voltage it shows in the source column (that is only this
            // one source's view of the city).
            const candidateRemaining = (city: number): number => {
              if (city === explanation.goal) return 0;
              const reducedIndex = system.cityIds.indexOf(city);
              if (reducedIndex < 0) return 0;
              return Math.max(0, finalStep.matrix_after[reducedIndex][reducedN + reducedIndex]);
            };

            const localMarkers: CircuitMarker[] = [
              { cityId, role: "focus" },
              ...(chosenNextId !== null ? [{ cityId: chosenNextId, role: "chosen" as const }] : []),
              ...candidates
                .filter((candidate) => !candidate.isChosen)
                .map((candidate) => ({ cityId: candidate.city, role: "considered" as const })),
            ];
            const cropIds = localMarkers.map((m) => m.cityId);

            const localMatrixIds = [cityId, ...edges.map((e) => e.neighborId)];
            const localMatrixLabels = localMatrixIds.map((id) => abbr(romaniaGraph.cities[id].name));
            const localMatrixRows = localMatrixIds.map((rowId) =>
              localMatrixIds.map((colId) => explanation.laplacian[rowId][colId]),
            );

            return (
              <section key={cityId} className={styles.card}>
                <h2 className={styles.nodeTitle}>
                  Terminal {index + 1} — {cityName}
                  <span className={styles.voltageTag}>{v.toFixed(1)}V</span>
                  {isStart && <span className={styles.sourceTag}>source, +1A</span>}
                </h2>
                <p className={styles.narrative}>
                  {isStart
                    ? `This is where the current starts, at ${v.toFixed(1)}V above ${goalName}'s ground.`
                    : `In this solved circuit, ${cityName} sits at ${v.toFixed(1)}V above ${goalName}'s ground.`}
                </p>

                <CircuitMap
                  viewBox={computeViewBox(cropIds, 130)}
                  edges={explanation.conductances}
                  potential={potential}
                  markers={localMarkers}
                  hotEdges={hotEdges}
                  consideredEdges={consideredEdges}
                />

                <CircuitLegend variant="terminal" />

                {chosenNextId !== null && candidates.length > 0 && (
                  <div className={styles.exploredBlock}>
                    <p className={styles.exploredTitle}>
                      {romaniaGraph.cities[chosenNextId].name} wins — lowest f = g + h
                      {chosenIsAdjacent ? "" : " (no direct road from here)"}
                    </p>
                    <p className={styles.exploredIntro}>
                      Every city waiting in the queue is scored the same way: g, the distance so
                      far to that city, plus h, the estimate still left to {goalName}. A*
                      expands the lowest f = g + h in the whole queue, not just the roads
                      leaving {cityName}.
                    </p>
                    <CandidateBarChart
                      candidates={candidates.map((candidate) => {
                        const driven = candidate.cost;
                        const remaining = candidateRemaining(candidate.city);
                        return {
                          name: romaniaGraph.cities[candidate.city].name,
                          driven,
                          remaining,
                          total: driven + remaining,
                          isChosen: candidate.isChosen,
                        };
                      })}
                    />
                    {nonAdjacentCandidates.length > 0 && (
                      <p className={styles.exploredNote}>
                        {nonAdjacentCandidates
                          .map((candidate) => romaniaGraph.cities[candidate.city].name)
                          .join(", ")}{" "}
                        {nonAdjacentCandidates.length === 1 ? "is" : "are"} also waiting in the
                        queue with no direct road from {cityName}. Because A* compares every
                        waiting city, the next city it expands is not always a neighbour.
                      </p>
                    )}

                    <SchematicGrid>
                      {adjacentCandidates.map((candidate) => {
                        const edge = edges.find((e) => e.neighborId === candidate.city);
                        if (!edge) return null;
                        const vi = potential[cityId] ?? 0;
                        const vj = potential[candidate.city] ?? 0;
                        return (
                          <div
                            key={candidate.city}
                            className={[
                              styles.schematicCard,
                              candidate.isChosen ? styles.schematicCardChosen : "",
                            ].join(" ")}
                          >
                            <CircuitSchematic
                              compact
                              fromLabel={cityName}
                              fromVoltage={vi}
                              fromIsSource={isStart}
                              toLabel={romaniaGraph.cities[candidate.city].name}
                              toVoltage={vj}
                              toIsGround={candidate.city === explanation.goal}
                              resistance={edge.distance}
                              conductance={edge.conductance}
                              current={edge.conductance * (vi - vj)}
                            />
                          </div>
                        );
                      })}
                    </SchematicGrid>
                  </div>
                )}

                <div className={styles.kclBlock}>
                  <p className={styles.kclTitle}>KCL at {cityName} — does it balance?</p>
                  {edges.map((edge, termIndex) => {
                    const vi = potential[cityId] ?? 0;
                    const vj = potential[edge.neighborId] ?? 0;
                    const value = edge.conductance * (vi - vj);
                    const neighborName = romaniaGraph.cities[edge.neighborId].name;
                    // Zero current (equal potential, or solver roundoff) has
                    // no direction to report, so it gets no arrow.
                    const direction = !carriesCurrent(value)
                      ? "No current flows on this road"
                      : value >= 0
                        ? `→ ${value.toFixed(3)}A out, toward ${neighborName}`
                        : `← ${Math.abs(value).toFixed(3)}A in, from ${neighborName}`;
                    return (
                      <div key={edge.neighborId} className={styles.kclTermBlock}>
                        <p className={styles.kclTermSetup}>
                          c({abbr(cityName)}
                          {abbr(neighborName)}) = 1/{edge.distance} ={" "}
                          <strong>{edge.conductance.toFixed(6)}</strong>
                        </p>
                        <p className={styles.kclTermLine}>
                          <span className={styles.kclTermIndex}>{termIndex + 1}.</span>{" "}
                          c({abbr(cityName)}
                          {abbr(neighborName)}) × (V{abbr(cityName)} − V
                          {abbr(neighborName)}) &nbsp;=&nbsp; {edge.conductance.toFixed(6)} × (
                          {vi.toFixed(2)} − {vj.toFixed(2)}) &nbsp;=&nbsp;{" "}
                          <strong>{value.toFixed(3)} A</strong>
                        </p>
                        <p className={styles.kclTermNote}>{direction}</p>
                      </div>
                    );
                  })}
                  {(() => {
                    const vi = potential[cityId] ?? 0;
                    const outflow = edges.reduce((sum, edge) => {
                      const value = edge.conductance * (vi - (potential[edge.neighborId] ?? 0));
                      return sum + (value > 0 ? value : 0);
                    }, 0);
                    const inflowFromEdges = edges.reduce((sum, edge) => {
                      const value = edge.conductance * (vi - (potential[edge.neighborId] ?? 0));
                      return sum + (value < 0 ? Math.abs(value) : 0);
                    }, 0);
                    const totalIn = inflowFromEdges + (isStart ? 1 : 0);
                    return <KclBalanceScale totalIn={totalIn} totalOut={outflow} />;
                  })()}
                </div>

                <div className={styles.localMatrixBlock}>
                  <p className={styles.derivationLabel}>
                    {cityName}&apos;s own row of the Kirchhoff matrix, up close:
                  </p>
                  <p className={styles.derivationSubLabel}>Diagonal:</p>
                  <div className={styles.derivationBlock}>
                    {edges.map((edge, i) => (
                      <p key={edge.neighborId} className={styles.derivationLine}>
                        c({abbr(cityName)}{abbr(romaniaGraph.cities[edge.neighborId].name)}) = 1/
                        {edge.distance} = {edge.conductance.toFixed(6)}
                        {i < edges.length - 1 ? "  +" : ""}
                      </p>
                    ))}
                    <p className={styles.derivationResult}>
                      K({abbr(cityName)}, {abbr(cityName)}) ={" "}
                      {edges.map((e) => e.conductance.toFixed(6)).join(" + ")} ={" "}
                      <strong>{edges.reduce((sum, e) => sum + e.conductance, 0).toFixed(6)}</strong>
                    </p>
                  </div>

                  <p className={styles.derivationSubLabel}>Off-diagonal:</p>
                  <div className={styles.derivationBlock}>
                    {edges.map((edge) => {
                      const neighborName = romaniaGraph.cities[edge.neighborId].name;
                      return (
                        <p key={edge.neighborId} className={styles.derivationLine}>
                          K({abbr(cityName)}, {abbr(neighborName)}) = −c({abbr(cityName)}
                          {abbr(neighborName)}) = −{edge.conductance.toFixed(6)}
                        </p>
                      );
                    })}
                  </div>

                  <MatrixBracket
                    rows={localMatrixRows}
                    rowLabels={localMatrixLabels}
                    colLabels={localMatrixLabels}
                    highlightRow={0}
                    highlightCol={0}
                    precision={4}
                  />
                </div>
              </section>
            );
          })}

          <section className={styles.card}>
            <h2>Summary</h2>
            <p className={styles.narrative}>
              We turned every road into a resistor, injected 1 amp of current at {startName}, and
              grounded {goalName} at 0 volts. Solving the circuit gave every city a voltage. Only{" "}
              {startName}&apos;s voltage is its own heuristic: divided by that 1 amp, it is
              h({startName}) = the circuit&apos;s total resistance. Every other city&apos;s
              voltage is just its value for this one source; that city&apos;s own h is a different
              diagonal entry.
            </p>
            <div className={styles.kclFormula}>
              h({startName}) = <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>
            </div>
            <p className={styles.narrative}>
              That number never overestimates the real driving distance, so A* using it is still
              guaranteed to find the true shortest route — just with a much smarter guess at how
              close it already is.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
