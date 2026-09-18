// app/circuit-flow/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import CalculationPage from "../../components/heuristic/CalculationPage";
import CircuitMap from "../../components/circuit/CircuitMap";
import type { CircuitMarker } from "../../components/circuit/CircuitMap";
import {
  VoltageBarChart,
  CircuitSchematic,
  SchematicGrid,
  CandidateBarChart,
  KclBalanceScale,
} from "../../components/circuit/CalculationVisuals";
import { computeViewBox } from "../../components/heuristic/RouteMap";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation, SearchResponse, SearchStep } from "../../lib/types";
import { runSearch } from "../../lib/wasm/client";
import styles from "./calculation.module.css";

function edgeKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

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
    <CalculationPage
      current="circuit"
      title="The road network as a circuit"
      intro="See how current flows from the selected city to the destination, terminal by terminal, before building the equations."
    >
      {(explanation) => <CircuitView explanation={explanation} />}
    </CalculationPage>
  );
}

type Edge = { neighborId: number; distance: number; conductance: number };

function CircuitView({ explanation }: { explanation: HeuristicExplanation }) {
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

  // ---- full unreduced Laplacian for Step 2's bracket matrix ----
  const fullLaplacianRows = romaniaGraph.cities.slice(0, cityCount).map((_, i) => explanation.laplacian[i]);
  const fullLabels = romaniaGraph.cities.slice(0, cityCount).map((c) => abbr(c.name));

  // ---- augmented system BEFORE elimination for Step 3, built straight
  // from system.matrix (the same grounded Laplacian Rust reduced) ----
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
          Each road&apos;s length in km is treated as its resistance in ohms — a longer road
          resists the flow of current more, just like a longer drive takes more effort.
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
          <span className={styles.stepBadge}>2</span> Build the circuit — the graph Laplacian
        </h2>
        <p className={styles.hint}>
          This packs every road into one big table called the Laplacian. Each city gets a row:
          its own column adds up all its roads, and every other column marks whether a direct
          road connects them.
        </p>

        <p className={styles.derivationLabel}>
          L({abbr(startName)}, {abbr(startName)}):
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
            L({abbr(startName)}, {abbr(startName)}) ={" "}
            {startNeighbors.map((e) => e.conductance.toFixed(6)).join(" + ")} ={" "}
            <strong>{startDiagonal.toFixed(6)}</strong>
          </p>
        </div>

        {startNeighbors[0] && (
          <>
            <p className={styles.derivationLabel}>
              L({abbr(startName)}, {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}):
            </p>
            <div className={styles.derivationBlock}>
              <p className={styles.derivationResult}>
                L({abbr(startName)}, {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}
                ) = −c({abbr(startName)}
                {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}) = −
                {startNeighbors[0].conductance.toFixed(6)}
              </p>
            </div>
          </>
        )}

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>
            Full {cityCount}×{cityCount} Laplacian
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
          <span className={styles.stepBadge}>3</span> Ground {goalName}, solve for voltages
        </h2>
        <p className={styles.hint}>
          Connecting {goalName} to the ground fixes it at 0 volts, so it&apos;s removed from the
          table below. Solving the remaining system tells us the voltage everywhere else — how
          "charged up" each city gets before its current drains away to {goalName}.
        </p>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>Before elimination</summary>
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
          <summary className={styles.matrixSummary}>After {reducedN} pivots</summary>
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
          <Link href={`/heuristic-steps?start=${explanation.start}&goal=${explanation.goal}`}>
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
          circuit — and that number becomes the distance estimate A* uses.
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
          The map below shows current actually flowing along the roads A* chose, from{" "}
          {startName} to {goalName}.
        </p>
        {searchError && (
          <p className={styles.errorText}>Could not load the A* search trace: {searchError}.</p>
        )}
        {!search && !searchError && <p className={styles.hint}>Loading…</p>}
        {search && (
          <>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={[styles.legendSwatch, styles.legendHot].join(" ")} /> high voltage
              </span>
              <span className={styles.legendItem}>
                <span className={[styles.legendSwatch, styles.legendCold].join(" ")} /> ground
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDotIcon} /> current
              </span>
            </div>
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
          <h2 className={styles.sectionDivider}>Tracing the current, terminal by terminal</h2>
          <p className={styles.dividerHint}>
            A* moved through {startName} to {goalName} one city at a time. At each stop below,
            it compared every road it could take next and always continued down the one with the
            least resistance left to ground.
          </p>

          {nodesToAnalyze.map((cityId, index) => {
            const isStart = cityId === explanation.start;
            const cityName = romaniaGraph.cities[cityId].name;
            const edges = (edgesByCity.get(cityId) ?? []).sort((a, b) => a.neighborId - b.neighborId);
            const v = potential[cityId] ?? 0;

            const stepIndex = findStepIndex(trace, cityId);
            const frontierAtStep = stepIndex >= 0 ? trace[stepIndex].frontier : [];
            const chosenNextId = stepIndex >= 0 ? (trace[stepIndex + 1]?.expanded_city ?? null) : null;
            const consideredNotChosen = frontierAtStep.filter((node) => node.city !== chosenNextId);
            const sortedFrontier = [...frontierAtStep].sort((a, b) => a.priority - b.priority);

            const hotEdges = new Set<string>();
            if (chosenNextId !== null) hotEdges.add(edgeKey(cityId, chosenNextId));
            const consideredEdges = new Set<string>();
            consideredNotChosen.forEach((node) => consideredEdges.add(edgeKey(cityId, node.city)));

            const localMarkers: CircuitMarker[] = [
              { cityId, role: "focus" },
              ...(chosenNextId !== null ? [{ cityId: chosenNextId, role: "chosen" as const }] : []),
              ...consideredNotChosen.map((node) => ({ cityId: node.city, role: "considered" as const })),
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
                    : `The current has reached ${cityName}, now sitting at ${v.toFixed(1)}V above ${goalName}'s ground.`}
                </p>

                <CircuitMap
                  viewBox={computeViewBox(cropIds, 130)}
                  edges={explanation.conductances}
                  potential={potential}
                  markers={localMarkers}
                  hotEdges={hotEdges}
                  consideredEdges={consideredEdges}
                />

                <div className={styles.legend}>
                  <span className={styles.legendItem}>
                    <span className={[styles.legendDot, styles.legendFocus].join(" ")} /> current
                  </span>
                  <span className={styles.legendItem}>
                    <span className={[styles.legendDot, styles.legendChosen].join(" ")} /> next hop
                  </span>
                  <span className={styles.legendItem}>
                    <span className={[styles.legendDot, styles.legendConsidered].join(" ")} />{" "}
                    considered
                  </span>
                </div>

                {consideredNotChosen.length > 0 && chosenNextId !== null && (
                  <div className={styles.exploredBlock}>
                    <p className={styles.exploredTitle}>
                      {romaniaGraph.cities[chosenNextId].name} wins — lowest total resistance
                    </p>
                    <p className={styles.exploredIntro}>
                      Every road out of {cityName} gets scored the same way: the resistance
                      already used to get here, plus the resistance still standing between that
                      next city and the ground. The lowest total wins.
                    </p>
                    <CandidateBarChart
                      candidates={sortedFrontier.map((node) => {
                        const isChosen = node.city === chosenNextId;
                        const driven = node.cost;
                        const candidateName = romaniaGraph.cities[node.city].name;
                        const isCandidateGoal = node.city === explanation.goal;
                        const candidateReducedIndex = system.cityIds.indexOf(node.city);
                        const remaining = isCandidateGoal
                          ? 0
                          : Math.max(
                              0,
                              finalStep.matrix_after[candidateReducedIndex][
                                reducedN + candidateReducedIndex
                              ],
                            );
                        return {
                          name: candidateName,
                          driven,
                          remaining,
                          total: driven + remaining,
                          isChosen,
                        };
                      })}
                    />

                    <SchematicGrid>
                      {sortedFrontier.map((node) => {
                        const isChosen = node.city === chosenNextId;
                        const edge = edges.find((e) => e.neighborId === node.city);
                        if (!edge) return null;
                        const vi = potential[cityId] ?? 0;
                        const vj = potential[node.city] ?? 0;
                        return (
                          <div
                            key={node.city}
                            className={[
                              styles.schematicCard,
                              isChosen ? styles.schematicCardChosen : "",
                            ].join(" ")}
                          >
                            <CircuitSchematic
                              compact
                              fromLabel={cityName}
                              fromVoltage={vi}
                              fromIsSource={isStart}
                              toLabel={romaniaGraph.cities[node.city].name}
                              toVoltage={vj}
                              toIsGround={node.city === explanation.goal}
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
                    const direction =
                      value >= 0
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
                    {cityName}&apos;s own row of the Laplacian, up close:
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
                      L({abbr(cityName)}, {abbr(cityName)}) ={" "}
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
                          L({abbr(cityName)}, {abbr(neighborName)}) = −c({abbr(cityName)}
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
              grounded {goalName} at 0 volts. Solving the circuit gave every city a voltage — and
              {startName}&apos;s own voltage, divided by that 1 amp, is the circuit&apos;s total
              resistance.
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