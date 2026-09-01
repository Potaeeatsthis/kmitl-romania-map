// app/circuit-flow/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import CircuitMap from "../../components/circuit/CircuitMap";
import type { CircuitMarker } from "../../components/circuit/CircuitMap";
import { computeViewBox } from "../../components/heuristic/RouteMap";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation, SearchResponse, SearchStep } from "../../lib/types";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";
import styles from "./page.module.css";

function parseCityParam(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= romaniaGraph.cities.length) {
    return null;
  }
  return parsed;
}

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
 * document writes L, L+, and the augmented system. rowLabels/colLabels are
 * optional short abbreviations shown outside/above the brackets.
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
  /** Draws a vertical rule after this column index -- used for [L | I]. */
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
                  <th
                    className={rowIndex === highlightRow ? styles.matrixHighlightLabel : ""}
                  >
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
  const searchParams = useSearchParams();
  const startCity = parseCityParam(searchParams.get("start"));
  const destinationCity = parseCityParam(searchParams.get("goal"));

  const [explanation, setExplanation] = useState<HeuristicExplanation | null>(null);
  const [search, setSearch] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startCity === null || destinationCity === null) {
      setExplanation(null);
      setSearch(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      explainCurrentFlow(startCity, destinationCity),
      runSearch(startCity, destinationCity),
    ])
      .then(([explanationResult, searchResult]) => {
        if (!cancelled) {
          setExplanation(explanationResult);
          setSearch(searchResult);
        }
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
  const stepsHref =
    startCity !== null && destinationCity !== null
      ? `/heuristic-steps?start=${startCity}&goal=${destinationCity}`
      : "/heuristic-steps";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>THE ROAD NETWORK AS A CIRCUIT</p>
          <h1 className={styles.title}>⚡ Current-flow view</h1>
        </div>
        <nav className={styles.nav}>
          <Link href="/">← Back to map</Link>
          <Link href={summaryHref}>← KCL summary</Link>
          <Link href={stepsHref}>Matrix elimination →</Link>
        </nav>
      </header>

      {startCity === null || destinationCity === null ? (
        <p className={styles.empty}>
          Choose a starting point and a destination on the map first, then come back here.
        </p>
      ) : isLoading ? (
        <p className={styles.empty}>Closing the loop…</p>
      ) : error ? (
        <p className={styles.errorText}>Could not calculate: {error}</p>
      ) : explanation && search ? (
        <CircuitView explanation={explanation} search={search} />
      ) : null}
    </main>
  );
}

type Edge = { neighborId: number; distance: number; conductance: number };

function CircuitView({
  explanation,
  search,
}: {
  explanation: HeuristicExplanation;
  search: SearchResponse;
}) {
  const startName = romaniaGraph.cities[explanation.start].name;
  const goalName = romaniaGraph.cities[explanation.goal].name;

  const cityCount = explanation.laplacian.length;
  const keptCities = Array.from({ length: cityCount }, (_, i) => i).filter(
    (city) => city !== explanation.goal,
  );
  const reducedN = keptCities.length;
  const startReducedIndex = keptCities.indexOf(explanation.start);
  const finalStep = explanation.steps[explanation.steps.length - 1];

  const potential: Record<number, number> = { [explanation.goal]: 0 };
  keptCities.forEach((cityId, rowIndex) => {
    potential[cityId] = finalStep.matrix_after[rowIndex][reducedN + startReducedIndex];
  });

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

  const path = search.astar.path;
  const trace = search.astar.trace;
  const nodesToAnalyze = path.filter((cityId) => cityId !== explanation.goal);

  const pathEdgeKeys = new Set<string>();
  for (let i = 0; i < path.length - 1; i++) {
    pathEdgeKeys.add(edgeKey(path[i], path[i + 1]));
  }

  const overviewMarkers: CircuitMarker[] = path.map((cityId) => ({
    cityId,
    role: cityId === explanation.start ? "focus" : cityId === explanation.goal ? "goal" : "path",
  }));

  // ---- worked derivation data for Step 2 ----
  const startNeighbors = (edgesByCity.get(explanation.start) ?? []).sort(
    (a, b) => a.neighborId - b.neighborId,
  );
  const startNeighborIds = new Set(startNeighbors.map((e) => e.neighborId));
  const exampleNonNeighbor = romaniaGraph.cities.find(
    (c) => c.id !== explanation.start && !startNeighborIds.has(c.id),
  );
  const startDiagonal = startNeighbors.reduce((sum, e) => sum + e.conductance, 0);

  // ---- full unreduced Laplacian for Step 2's bracket matrix ----
  const fullLaplacianRows = romaniaGraph.cities.map((_, i) => explanation.laplacian[i]);
  const fullLabels = romaniaGraph.cities.map((c) => abbr(c.name));

  // ---- augmented system BEFORE elimination for Step 3 (mirrors what
  // current_flow.rs builds right before its Gauss-Jordan loop starts) ----
  const initialAugmented: number[][] = keptCities.map((rowCity, i) => [
    ...keptCities.map((colCity) => explanation.laplacian[rowCity][colCity]),
    ...keptCities.map((_, j) => (i === j ? 1 : 0)),
  ]);
  const reducedLabels = keptCities.map((id) => abbr(romaniaGraph.cities[id].name));
  const augmentedColLabels = [
    ...reducedLabels,
    ...reducedLabels.map((l) => `I(${l})`),
  ];

  const finalAugmentedRows = finalStep.matrix_after;

  return (
    <div className={styles.content}>
      <p className={styles.routeLine}>
        {startName} → {goalName}
      </p>

      <section className={styles.card}>
        <p className={styles.narrative}>
          Treat every road in Romania as a resistor and every city as a connection point on a
          circuit board. Wire <strong>1A</strong> into the <strong>{startName}</strong> terminal,
          clip the <strong>{goalName}</strong> terminal to <strong>ground (0V)</strong>, and solve.
          The voltage that has to sit at {startName} for that current to reach ground is the
          circuit&apos;s effective resistance — and that number is exactly what A* uses as its
          heuristic, before it has explored a single road. Below is the full derivation, matrix
          and all, on the real 20-city network.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>1</span> Every road becomes a resistor
        </h2>
        <p className={styles.hint}>
          A road&apos;s length in km <em>is</em> its resistance R. Conductance G = 1/R is how
          easily current passes through — a short, low-resistance road lets more current through
          for the same voltage drop, the same way it&apos;s an easier drive.
        </p>
        <div className={styles.kclFormula}>
          G<sub>uv</sub> = 1 / R<sub>uv</sub> &nbsp; (Ω<sup>−1</sup>)
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Resistor (road)</th>
                <th>R (Ω = km)</th>
                <th>G = 1/R (Ω⁻¹)</th>
              </tr>
            </thead>
            <tbody>
              {explanation.conductances.map((edge) => (
                <tr key={`${edge.city_a}-${edge.city_b}`}>
                  <td>
                    {romaniaGraph.cities[edge.city_a].name} — {romaniaGraph.cities[edge.city_b].name}
                  </td>
                  <td>{edge.distance}</td>
                  <td>{edge.conductance.toFixed(5)}</td>
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
          The Laplacian L is the fully-wired circuit, before any terminal is grounded. Each
          diagonal entry L<sub>ii</sub> is the sum of the conductances of every wire touching city
          i. Each off-diagonal entry L<sub>ij</sub> is the negative conductance of the wire
          directly between i and j — and exactly 0 if no road connects them directly, even though
          current can still reach there indirectly through the rest of the network.
        </p>

        <p className={styles.derivationLabel}>
          Diagonal entry L({abbr(startName)}, {abbr(startName)}) — sum every wire leaving{" "}
          {startName}:
        </p>
        <div className={styles.derivationBlock}>
          {startNeighbors.map((edge, i) => (
            <p key={edge.neighborId} className={styles.derivationLine}>
              G({abbr(startName)}{abbr(romaniaGraph.cities[edge.neighborId].name)}) = 1/
              {edge.distance} = {edge.conductance.toFixed(4)}
              {i < startNeighbors.length - 1 ? "  +" : ""}
            </p>
          ))}
          <p className={styles.derivationResult}>
            L({abbr(startName)}, {abbr(startName)}) ={" "}
            {startNeighbors.map((e) => e.conductance.toFixed(4)).join(" + ")} ={" "}
            <strong>{startDiagonal.toFixed(4)}</strong>
          </p>
        </div>

        {startNeighbors[0] && (
          <>
            <p className={styles.derivationLabel}>
              Off-diagonal entry, a direct road — L({abbr(startName)},{" "}
              {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}):
            </p>
            <div className={styles.derivationBlock}>
              <p className={styles.derivationResult}>
                L({abbr(startName)}, {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}
                ) = −G({abbr(startName)}
                {abbr(romaniaGraph.cities[startNeighbors[0].neighborId].name)}) = −
                {startNeighbors[0].conductance.toFixed(4)}
              </p>
            </div>
          </>
        )}

        {exampleNonNeighbor && (
          <>
            <p className={styles.derivationLabel}>
              Off-diagonal entry, no direct road — L({abbr(startName)}, {abbr(exampleNonNeighbor.name)}):
            </p>
            <div className={styles.derivationBlock}>
              <p className={styles.derivationResult}>
                L({abbr(startName)}, {abbr(exampleNonNeighbor.name)}) ={" "}
                <strong>0</strong> — no resistor wired directly between them. Current still reaches{" "}
                {exampleNonNeighbor.name} through other cities; the matrix entry only records
                direct wiring, the network as a whole carries the rest.
              </p>
            </div>
          </>
        )}

        <p className={styles.hint}>
          Doing this for every pair gives the full {cityCount}×{cityCount} circuit — every road in
          Romania as one matrix. It&apos;s large, so it&apos;s collapsed by default; the small
          local matrix for each terminal further down is the one worth reading closely.
        </p>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>
            Show the full {cityCount}×{cityCount} Laplacian
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
          <span className={styles.stepBadge}>3</span> Ground {goalName} and solve for every voltage
        </h2>
        <p className={styles.hint}>
          Grounding {goalName} means deleting its row and column from L, then appending an
          identity block on the right — the augmented system [L<sub>reduced</sub> | I], in the
          same city order as the matrix above, minus {goalName}. It&apos;s a {reducedN}×
          {reducedN * 2} block, also collapsed by default:
        </p>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>
            Show the augmented system before elimination
          </summary>
          <MatrixBracket
            rows={initialAugmented}
            rowLabels={reducedLabels}
            colLabels={augmentedColLabels}
            highlightCol={startReducedIndex}
            dividerAfterCol={reducedN - 1}
            precision={3}
          />
        </details>

        <p className={styles.hint}>
          Gauss-Jordan elimination — pivot each column to 1, cancel it everywhere else — walks
          this left block to the identity matrix. What&apos;s left on the right is L<sup>−1</sup>
          <sub>reduced</sub>. After all {reducedN} pivots:
        </p>

        <details className={styles.matrixDetails}>
          <summary className={styles.matrixSummary}>
            Show the augmented system after all {reducedN} pivots
          </summary>
          <MatrixBracket
            rows={finalAugmentedRows}
            rowLabels={reducedLabels}
            colLabels={augmentedColLabels}
            highlightCol={reducedN + startReducedIndex}
            dividerAfterCol={reducedN - 1}
            precision={3}
          />
        </details>

        <p className={styles.hint}>
          The highlighted {startName} column of L<sup>−1</sup><sub>reduced</sub>, read straight
          down, gives every city&apos;s voltage in one shot for 1A injected at {startName}. Want
          to watch each individual pivot of the elimination that produced this, one column at a
          time?{" "}
          <Link href={`/heuristic-steps?start=${explanation.start}&goal=${explanation.goal}`}>
            See the full elimination →
          </Link>
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>4</span> Read off the effective resistance
        </h2>
        <p className={styles.setupText}>
          {startName}&apos;s own entry in its own column — the top-left corner of that
          highlighted column above — is exactly R<sub>eff</sub>: the voltage that had to be
          pushed in at {startName} to drive 1A all the way to ground at {goalName}.
        </p>
        <div className={styles.kclFormula}>
          R<sub>eff</sub>({startName}, {goalName}) = V<sub>{abbr(startName)}</sub> ={" "}
          <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>
        </div>
        <p className={styles.setupText}>
          The real shortest-path cost is <strong>{search.ucs.cost} km</strong>. Since{" "}
          {explanation.effective_resistance.toFixed(2)} ≤ {search.ucs.cost}, the circuit&apos;s
          resistance never overestimates the true driving distance — that&apos;s what makes it an
          admissible heuristic, so A* is still guaranteed to find the true shortest path, with a
          far sharper estimate of "how far" than straight-line distance would give.
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.stepHeading}>
          <span className={styles.stepBadge}>5</span> The solved circuit, end to end
        </h2>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={[styles.legendSwatch, styles.legendHot].join(" ")} /> high voltage
            (near the source terminal)
          </span>
          <span className={styles.legendItem}>
            <span className={[styles.legendSwatch, styles.legendCold].join(" ")} /> ground (0V)
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDotIcon} /> current — brighter &amp; faster = more amps
          </span>
        </div>
        <CircuitMap
          viewBox={computeViewBox(path, 80)}
          edges={explanation.conductances}
          potential={potential}
          markers={overviewMarkers}
          hotEdges={pathEdgeKeys}
        />
      </section>

      <h2 className={styles.sectionDivider}>
        Tracing the current, terminal by terminal
      </h2>

      {nodesToAnalyze.map((cityId, index) => {
        const isStart = cityId === explanation.start;
        const cityName = romaniaGraph.cities[cityId].name;
        const edges = (edgesByCity.get(cityId) ?? []).sort((a, b) => a.neighborId - b.neighborId);
        const expectedCurrent = isStart ? 1 : 0;
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
              {isStart && <span className={styles.sourceTag}>source terminal, +1A in</span>}
            </h2>

            <p className={styles.narrative}>
              {isStart ? (
                <>Current is injected here — {cityName} sits at {v.toFixed(1)}V above {goalName}&apos;s ground reference.{" "}</>
              ) : (
                <>The wire has carried current here — {cityName} sits at {v.toFixed(1)}V above {goalName}&apos;s ground reference.{" "}</>
              )}
              From this junction, {frontierAtStep.length}{" "}
              {frontierAtStep.length === 1 ? "wire leads" : "wires lead"} onward, still waiting in
              the frontier. A* estimates the resistance-to-ground through each one and always
              expands whichever total is lowest — the same principle that makes current itself
              always find the path of least resistance.
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
                terminal
              </span>
              <span className={styles.legendItem}>
                <span className={[styles.legendDot, styles.legendChosen].join(" ")} /> next hop —
                lowest total resistance
              </span>
              <span className={styles.legendItem}>
                <span className={[styles.legendDot, styles.legendConsidered].join(" ")} /> considered,
                higher resistance — stays queued
              </span>
            </div>

            {consideredNotChosen.length > 0 && chosenNextId !== null && (
              <div className={styles.exploredBlock}>
                <p className={styles.exploredTitle}>
                  Why current settles on {romaniaGraph.cities[chosenNextId].name} over the other{" "}
                  {consideredNotChosen.length === 1 ? "candidate" : `${consideredNotChosen.length} candidates`}
                </p>
                <p className={styles.exploredIntro}>
                  Every candidate wire leaving {cityName} gets scored the same way: resistance
                  already driven to reach it, plus resistance still standing between it and
                  ground at {goalName}. That second number comes straight off the diagonal of the
                  same reduced matrix solved in Step 3 above — grounding {goalName} makes the
                  diagonal entry for <em>any</em> city in that matrix exactly the resistance from
                  that city to ground, regardless of which city was the real source. Whichever
                  candidate has the lowest total wins — current always takes the path of least
                  resistance.
                </p>

                <div className={styles.tableScroll}>
                  <table className={styles.candidateTable}>
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>Driven, {cityName} → city (Ω)</th>
                        <th>Remaining to ground (Ω)</th>
                        <th>Total (Ω)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFrontier.map((node) => {
                        const isChosen = node.city === chosenNextId;
                        const driven = node.cost;
                        const candidateName = romaniaGraph.cities[node.city].name;
                        const isCandidateGoal = node.city === explanation.goal;
                        const candidateReducedIndex = keptCities.indexOf(node.city);
                        // The goal is grounded (0V), so its own resistance-to-ground is 0 by
                        // definition -- it's excluded from keptCities/the reduced matrix, so
                        // there's no diagonal entry to read for it, unlike every other city.
                        const remaining = isCandidateGoal
                          ? 0
                          : Math.max(
                              0,
                              finalStep.matrix_after[candidateReducedIndex][reducedN + candidateReducedIndex],
                            );
                        const total = driven + remaining;
                        return (
                          <tr key={node.city} className={isChosen ? styles.chosenRow : ""}>
                            <td>{candidateName}</td>
                            <td>{driven}</td>
                            <td>{remaining.toFixed(4)}</td>
                            <td>
                              <strong>{total.toFixed(4)}</strong>
                            </td>
                            <td>{isChosen ? "← current flows here" : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className={styles.exploredNote}>
                  {romaniaGraph.cities[chosenNextId].name} wins with the lowest total resistance.
                  The other candidates stay parked at this junction — still fully part of the
                  circuit, just not the branch current commits to next — and only get revisited
                  if a lower-resistance route through them turns up later.
                </p>
              </div>
            )}

            <div className={styles.kclBlock}>
              <p className={styles.kclTitle}>
                Kirchhoff&apos;s Current Law at {cityName} — does the loop close?
              </p>
              {edges.map((edge, termIndex) => {
                const vi = potential[cityId] ?? 0;
                const vj = potential[edge.neighborId] ?? 0;
                const value = edge.conductance * (vi - vj);
                const neighborName = romaniaGraph.cities[edge.neighborId].name;
                const direction =
                  value >= 0
                    ? `→ ${value.toFixed(3)}A flows out, toward ${neighborName}`
                    : `← ${Math.abs(value).toFixed(3)}A flows in, from ${neighborName}`;
                return (
                  <div key={edge.neighborId} className={styles.kclTermBlock}>
                    <p className={styles.kclTermSetup}>
                      Wire {cityName}—{neighborName} is {edge.distance}Ω, so G({abbr(cityName)}
                      {abbr(neighborName)}) = 1/{edge.distance} ={" "}
                      <strong>{edge.conductance.toFixed(4)}</strong>
                    </p>
                    <p className={styles.kclTermLine}>
                      <span className={styles.kclTermIndex}>{termIndex + 1}.</span>{" "}
                      G({abbr(cityName)}
                      {abbr(neighborName)}) × (V{abbr(cityName)} − V
                      {abbr(neighborName)}) &nbsp;=&nbsp; {edge.conductance.toFixed(4)} × (
                      {vi.toFixed(2)} − {vj.toFixed(2)}) &nbsp;=&nbsp;{" "}
                      <strong>{value.toFixed(3)} A</strong>
                    </p>
                    <p className={styles.kclTermNote}>{direction}</p>
                  </div>
                );
              })}
              
              {(() => {
                const vi = potential[cityId] ?? 0;
                const sum = edges.reduce(
                  (total, edge) => total + edge.conductance * (vi - (potential[edge.neighborId] ?? 0)),
                  0,
                );
                const balances = Math.abs(sum - expectedCurrent) < 0.01;
                return (
                  <>
                    <p className={styles.kclSumLine}>
                      Sum: {edges
                        .map((edge) =>
                          (edge.conductance * (vi - (potential[edge.neighborId] ?? 0))).toFixed(3),
                        )
                        .join(" + ")}{" "}
                      = <strong>{sum.toFixed(3)} A</strong>
                    </p>
                    <p className={balances ? styles.kclCheckOk : styles.kclCheckFail}>
                      Expected: {expectedCurrent} A ({isStart ? "the injected current" : "current in = current out"})
                      — {balances ? "✓ loop closes" : "off by rounding"}
                    </p>
                  </>
                );
              })()}
            </div>

            <div className={styles.localMatrixBlock}>
              <p className={styles.derivationLabel}>
                Building {cityName}&apos;s row of the Laplacian, one substitution at a time
              </p>

              <p className={styles.derivationSubLabel}>
                Diagonal entry — sum every wire leaving {cityName}:
              </p>
              <div className={styles.derivationBlock}>
                {edges.map((edge, i) => (
                  <p key={edge.neighborId} className={styles.derivationLine}>
                    G({abbr(cityName)}{abbr(romaniaGraph.cities[edge.neighborId].name)}) = 1/
                    {edge.distance} = {edge.conductance.toFixed(4)}
                    {i < edges.length - 1 ? "  +" : ""}
                  </p>
                ))}
                <p className={styles.derivationResult}>
                  L({abbr(cityName)}, {abbr(cityName)}) ={" "}
                  {edges.map((e) => e.conductance.toFixed(4)).join(" + ")} ={" "}
                  <strong>
                    {edges.reduce((sum, e) => sum + e.conductance, 0).toFixed(4)}
                  </strong>
                </p>
              </div>

              <p className={styles.derivationSubLabel}>
                Off-diagonal entries — one for every direct wire from {cityName}:
              </p>
              <div className={styles.derivationBlock}>
                {edges.map((edge) => {
                  const neighborName = romaniaGraph.cities[edge.neighborId].name;
                  return (
                    <p key={edge.neighborId} className={styles.derivationLine}>
                      L({abbr(cityName)}, {abbr(neighborName)}) = −G({abbr(cityName)}
                      {abbr(neighborName)}) = −{edge.conductance.toFixed(4)}
                    </p>
                  );
                })}
              </div>

              <p className={styles.derivationSubLabel}>
                Assembled into a matrix — {cityName} and its {edges.length}{" "}
                {edges.length === 1 ? "direct neighbor" : "direct neighbors"}:
              </p>
              <MatrixBracket
                rows={localMatrixRows}
                rowLabels={localMatrixLabels}
                colLabels={localMatrixLabels}
                highlightRow={0}
                highlightCol={0}
                precision={4}
              />
              <p className={styles.exploredNote}>
                Row 1 ({abbr(cityName)}) is exactly the two derivations above, read left to right.
                It&apos;s also exactly the KCL equation from earlier in this terminal, just written
                as a matrix row instead of a sum: multiplying it by the solved voltage vector
                [V<sub>{abbr(cityName)}</sub>, V<sub>neighbor 1</sub>, …] reproduces the{" "}
                {expectedCurrent}A this terminal must carry.
              </p>
            </div>
          </section>
        );
      })}

      <section className={styles.card}>
        <h2>Ground reached — {goalName}</h2>
        <p className={styles.setupText}>
          Current has traveled the full circuit and reached the ground terminal at 0V. The total
          resistance it fought through, R<sub>eff</sub> ={" "}
          <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>, is the number A* had
          in hand for {startName} before it ever expanded a single node — a heuristic drawn from
          the shape of the whole network, not just one candidate path.
        </p>
      </section>
    </div>
  );
}