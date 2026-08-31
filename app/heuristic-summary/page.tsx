// app/heuristic-summary/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import RouteMap, { computeViewBox } from "../../components/heuristic/RouteMap";
import type { RouteMapMarker } from "../../components/heuristic/RouteMap";
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

export default function HeuristicSummaryPage() {
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

  const stepsHref =
    startCity !== null && destinationCity !== null
      ? `/heuristic-steps?start=${startCity}&goal=${destinationCity}`
      : "/heuristic-steps";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>KIRCHHOFF&apos;S CURRENT LAW — WORKED SOLUTION</p>
          <h1 className={styles.title}>Why A* picks this path</h1>
        </div>
        <nav className={styles.nav}>
          <Link href="/">← Back to map</Link>
          <Link href={stepsHref}>Matrix elimination →</Link>
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
      ) : explanation && search ? (
        <SummaryView explanation={explanation} search={search} />
      ) : null}
    </main>
  );
}

type Edge = { neighborId: number; distance: number; conductance: number };

function findStepIndex(trace: SearchStep[], cityId: number): number {
  return trace.findIndex((step) => step.expanded_city === cityId);
}

function SummaryView({
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

  const overviewMarkers: RouteMapMarker[] = path.map((cityId) => ({
    cityId,
    role: cityId === explanation.start ? "focus" : cityId === explanation.goal ? "goal" : "path",
  }));

  return (
    <div className={styles.content}>
      <p className={styles.routeLine}>
        {startName} → {goalName}
      </p>

      <section className={styles.card}>
        <h2>Route overview</h2>
        <p className={styles.hint}>
          The real road map, with the path A* actually chose highlighted.
        </p>
        <RouteMap viewBox={computeViewBox(path, 60)} pathCityIds={path} markers={overviewMarkers} />
      </section>

      <section className={styles.card}>
        <h2>1. Conductance of every road</h2>
        <div className={styles.kclFormula}>
          G = 1 / R (Ω<sup>−1</sup>)
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Road</th>
                <th>R (km)</th>
                <th>G = 1/R</th>
              </tr>
            </thead>
            <tbody>
              {explanation.conductances.map((edge) => (
                <tr key={`${edge.city_a}-${edge.city_b}`}>
                  <td>
                    {romaniaGraph.cities[edge.city_a].name} – {romaniaGraph.cities[edge.city_b].name}
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
        <h2>2. Setup</h2>
        <p className={styles.setupText}>
          Inject <strong>1 A</strong> at <strong>{startName}</strong>, hold{" "}
          <strong>{goalName} at 0 V</strong> (grounded). At every other node, current in = current
          out:
        </p>
        <div className={styles.kclFormula}>
          Σ<sub>j</sub> G<sub>ij</sub> (V<sub>i</sub> − V<sub>j</sub>) = I<sub>i</sub>
        </div>
      </section>

      {nodesToAnalyze.map((cityId, index) => {
        const isStart = cityId === explanation.start;
        const edges = (edgesByCity.get(cityId) ?? []).sort((a, b) => a.neighborId - b.neighborId);
        const expectedCurrent = isStart ? 1 : 0;

        const stepIndex = findStepIndex(trace, cityId);
        const frontierAtStep = stepIndex >= 0 ? trace[stepIndex].frontier : [];
        const chosenNextId = stepIndex >= 0 ? (trace[stepIndex + 1]?.expanded_city ?? null) : null;
        const consideredNotChosen = frontierAtStep.filter((node) => node.city !== chosenNextId);
        const sortedFrontier = [...frontierAtStep].sort((a, b) => a.priority - b.priority);
        const bestConsidered = sortedFrontier.find((node) => node.city !== chosenNextId);

        const mapMarkers: RouteMapMarker[] = [
          { cityId, role: "focus" },
          ...(chosenNextId !== null ? [{ cityId: chosenNextId, role: "chosen" as const }] : []),
          ...consideredNotChosen.map((node) => ({
            cityId: node.city,
            role: "considered" as const,
            note: `f=${node.priority.toFixed(0)}`,
          })),
        ];
        const cropIds = mapMarkers.map((m) => m.cityId);

        return (
          <section key={cityId} className={styles.card}>
            <h2>
              Node {index + 1} — {romaniaGraph.cities[cityId].name}
              {isStart && <span className={styles.sourceTag}>current source, +1 A</span>}
            </h2>

            <RouteMap viewBox={computeViewBox(cropIds, 100)} markers={mapMarkers} />

            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={[styles.legendDot, styles.legendFocus].join(" ")} /> current node
              </span>
              <span className={styles.legendItem}>
                <span className={[styles.legendDot, styles.legendChosen].join(" ")} /> chosen next
                (lowest f)
              </span>
              <span className={styles.legendItem}>
                <span className={[styles.legendDot, styles.legendConsidered].join(" ")} /> considered,
                not chosen
              </span>
            </div>

            {consideredNotChosen.length > 0 && chosenNextId !== null && (
              <div className={styles.exploredBlock}>
                <p className={styles.exploredTitle}>
                  Why not the other{" "}
                  {consideredNotChosen.length === 1 ? "city" : `${consideredNotChosen.length} cities`}{" "}
                  in the queue?
                </p>
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>City</th>
                        <th>g(n) — travelled</th>
                        <th>h(n) — estimate</th>
                        <th>f(n) = g+h</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedFrontier.map((node) => {
                        const isChosen = node.city === chosenNextId;
                        return (
                          <tr key={node.city} className={isChosen ? styles.chosenRow : ""}>
                            <td>{romaniaGraph.cities[node.city].name}</td>
                            <td>{node.cost}</td>
                            <td>{(node.priority - node.cost).toFixed(1)}</td>
                            <td>
                              <strong>{node.priority.toFixed(1)}</strong>
                            </td>
                            <td>{isChosen ? "← picked, lowest f" : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {bestConsidered && (
                  <p className={styles.exploredNote}>
                    {romaniaGraph.cities[bestConsidered.city].name} had f ={" "}
                    {bestConsidered.priority.toFixed(1)}, higher than{" "}
                    {romaniaGraph.cities[chosenNextId].name}&apos;s f ={" "}
                    {trace[stepIndex + 1] ? sortedFrontier[0].priority.toFixed(1) : "—"} — so it stays
                    in the queue for now, or is abandoned if a cheaper path is never found.
                  </p>
                )}
              </div>
            )}

            <div className={styles.kclBlock}>
              <p className={styles.kclTitle}>KCL at {romaniaGraph.cities[cityId].name}</p>
              {edges.map((edge, termIndex) => {
                const vi = potential[cityId] ?? 0;
                const vj = potential[edge.neighborId] ?? 0;
                const value = edge.conductance * (vi - vj);
                return (
                  <p key={edge.neighborId} className={styles.kclTermLine}>
                    <span className={styles.kclTermIndex}>{termIndex + 1}.</span>{" "}
                    G({romaniaGraph.cities[cityId].name.slice(0, 3)}
                    {romaniaGraph.cities[edge.neighborId].name.slice(0, 3)}) × (V
                    {romaniaGraph.cities[cityId].name.slice(0, 3)} − V
                    {romaniaGraph.cities[edge.neighborId].name.slice(0, 3)}) &nbsp;=&nbsp;{" "}
                    {edge.conductance.toFixed(4)} × ({vi.toFixed(2)} − {vj.toFixed(2)}) &nbsp;=&nbsp;{" "}
                    <strong>{value.toFixed(3)} A</strong>
                  </p>
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
                      Expected: {expectedCurrent} A — {balances ? "✓ balances" : "off by rounding"}
                    </p>
                  </>
                );
              })()}
            </div>
          </section>
        );
      })}

      <section className={styles.card}>
        <h2>Result</h2>
        <p className={styles.setupText}>
          The effective resistance is the voltage that had to be applied at {startName} to push 1
          A all the way to {goalName} (0 V):
        </p>
        <div className={styles.kclFormula}>
          R<sub>eff</sub> = V<sub>{startName.slice(0, 3)}</sub> ={" "}
          <strong>{explanation.effective_resistance.toFixed(4)} Ω</strong>
        </div>
        <p className={styles.setupText}>
          Real shortest distance: <strong>{search.ucs.cost} km</strong>. Since{" "}
          {explanation.effective_resistance.toFixed(2)} ≤ {search.ucs.cost}, A* never
          overestimates and is guaranteed to find the true shortest path.
        </p>
      </section>
    </div>
  );
}