// app/heuristic-summary/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import CalculationStepper from "../../components/heuristic/CalculationStepper";
import RouteMap, { computeViewBox } from "../../components/heuristic/RouteMap";
import type { RouteMapMarker } from "../../components/heuristic/RouteMap";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation, SearchResponse } from "../../lib/types";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";
import styles from "./page.module.css";

type Edge = {
  neighborId: number;
  distance: number;
  conductance: number;
};

function parseCityParam(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
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

  const query = startCity !== null && destinationCity !== null ? `?start=${startCity}&goal=${destinationCity}` : "";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>How A* chose this route</h1>
          <p className={styles.headerIntro}>
            Follow every A* decision. Select any h(n) value to see its conductance and Kirchhoff calculation.
          </p>
        </div>
        <CalculationStepper query={query} />
      </header>

      {startCity === null || destinationCity === null ? (
        <p className={styles.empty}>
          Choose a starting point and a destination on the map first, then come back here.
        </p>
      ) : isLoading ? (
        <p className={styles.empty} role="status">Calculating the Kirchhoff system…</p>
      ) : error ? (
        <p className={styles.errorText} role="alert">Could not calculate: {error}</p>
      ) : explanation && search ? (
        <SummaryView explanation={explanation} search={search} />
      ) : null}
    </main>
  );
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
  const system = buildGroundedKirchhoffSystem(explanation);
  const path = search.astar.path;
  const pathNames = path.map((cityId) => romaniaGraph.cities[cityId].name).join(" → ");
  const trace = search.astar.trace;

  const potential: Record<number, number> = { [explanation.goal]: 0 };
  system.cityIds.forEach((cityId, index) => {
    potential[cityId] = system.voltage[index];
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

  const overviewMarkers: RouteMapMarker[] = path.map((cityId) => ({
    cityId,
    role: cityId === explanation.start ? "focus" : cityId === explanation.goal ? "goal" : "path",
  }));
  const walkthroughSteps = trace
    .map((step, traceIndex) => ({ step, traceIndex }))
    .filter(({ step }) => step.expanded_city !== explanation.goal);

  return (
    <div className={styles.content}>
      <section className={styles.routeOverview} aria-labelledby="selected-route-title">
        <div className={styles.routeCopy}>
          <h2 id="selected-route-title">{startName} → {goalName}</h2>
          <p>
            A* found a {search.astar.cost} km route after expanding {search.astar.expanded} cities.
            The walkthrough below shows where its estimate comes from and how each next city is chosen.
          </p>
          <p className={styles.pathLine}>{pathNames}</p>
        </div>
        <div className={styles.routeMap}>
          <RouteMap
            viewBox={computeViewBox(path, 60)}
            pathCityIds={path}
            markers={overviewMarkers}
          />
        </div>
      </section>

      <section className={styles.walkthrough} aria-labelledby="walkthrough-title">
        <div className={styles.walkthroughHeader}>
          <div>
            <h2 id="walkthrough-title">A* decision by decision</h2>
            <p>
              At each expansion, A* compares the queue and chooses the city with the smallest f(n) = g(n) + h(n).
            </p>
          </div>
          <div className={styles.stepLegend} aria-label="Map marker key">
            <span><i className={styles.legendFocus} />current city</span>
            <span><i className={styles.legendChosen} />chosen next</span>
            <span><i className={styles.legendConsidered} />waiting in queue</span>
          </div>
        </div>

        <div className={styles.nodeSteps}>
          {walkthroughSteps.map(({ step, traceIndex }) => {
            const cityId = step.expanded_city;
            const cityName = romaniaGraph.cities[cityId].name;
            const isStart = cityId === explanation.start;
            const edges = [...(edgesByCity.get(cityId) ?? [])].sort(
              (a, b) => a.neighborId - b.neighborId,
            );
            const expectedCurrent = isStart ? 1 : 0;
            const chosenNextId = trace[traceIndex + 1]?.expanded_city ?? null;
            const sortedFrontier = [...step.frontier].sort(
              (a, b) => a.priority - b.priority || a.cost - b.cost || a.city - b.city,
            );
            const chosenCandidate = chosenNextId === null
              ? null
              : sortedFrontier.find((candidate) => candidate.city === chosenNextId) ?? null;
            const considered = sortedFrontier.filter((candidate) => candidate.city !== chosenNextId);
            const mapMarkers: RouteMapMarker[] = [
              { cityId, role: "focus" },
              ...(chosenNextId !== null ? [{ cityId: chosenNextId, role: "chosen" as const }] : []),
              ...considered.map((candidate) => ({
                cityId: candidate.city,
                role: "considered" as const,
                note: `f=${candidate.priority.toFixed(0)}`,
              })),
            ];
            const vi = potential[cityId] ?? 0;
            const currentRows = edges.map((edge) => {
              const vj = potential[edge.neighborId] ?? 0;
              return {
                ...edge,
                voltageDifference: vi - vj,
                current: edge.conductance * (vi - vj),
              };
            });
            const currentSum = currentRows.reduce((sum, row) => sum + row.current, 0);
            const balances = Math.abs(currentSum - expectedCurrent) < 0.01;

            return (
              <article id={`decision-${traceIndex}`} className={styles.nodeCard} key={`${cityId}-${traceIndex}`}>
                <header className={styles.nodeHeader}>
                  <h3>
                    <span>Expansion {traceIndex + 1}</span> — {cityName}
                  </h3>
                  {isStart && <strong>1 A current source</strong>}
                </header>

                <div className={styles.nodeDecision}>
                  <RouteMap
                    viewBox={computeViewBox(mapMarkers.map((marker) => marker.cityId), 100)}
                    markers={mapMarkers}
                  />

                  <div className={styles.decisionPanel}>
                    <h4>Choose the next city</h4>
                    {chosenCandidate ? (
                      <>
                        <div className={styles.scoreEquation}>
                          <div><span>g(n)</span><strong>{chosenCandidate.cost.toFixed(1)}</strong><small>travelled</small></div>
                          <b aria-hidden="true">+</b>
                          <div>
                            <span>h(n)</span>
                            <Link
                              className={styles.heuristicLink}
                              href={`/kirchhoff-matrix?start=${chosenCandidate.city}&goal=${explanation.goal}&routeStart=${explanation.start}&decision=${traceIndex}` }
                              aria-label={`Show how h(${romaniaGraph.cities[chosenCandidate.city].name}) is calculated`}
                            >
                              <strong>{(chosenCandidate.priority - chosenCandidate.cost).toFixed(2)}</strong>
                            </Link>
                            <small>estimate</small>
                          </div>
                          <b aria-hidden="true">=</b>
                          <div className={styles.totalScore}><span>f(n)</span><strong>{chosenCandidate.priority.toFixed(2)}</strong><small>priority</small></div>
                        </div>
                        <p className={styles.decisionFormula} role="math" aria-label={`Priority formula for ${romaniaGraph.cities[chosenCandidate.city].name}`}>
                          f({romaniaGraph.cities[chosenCandidate.city].name}) = g + h = {chosenCandidate.cost.toFixed(1)} + {(chosenCandidate.priority - chosenCandidate.cost).toFixed(2)} = {chosenCandidate.priority.toFixed(2)}
                        </p>
                        <p className={styles.choiceFormula} role="math" aria-label="Lowest priority formula">
                          min&#123;{sortedFrontier.map((candidate) => `f(${romaniaGraph.cities[candidate.city].name}) = ${candidate.priority.toFixed(2)}`).join(", ")}&#125; = f({romaniaGraph.cities[chosenCandidate.city].name}) = {chosenCandidate.priority.toFixed(2)}
                        </p>
                        <p className={styles.choiceText}>
                          <strong>{romaniaGraph.cities[chosenCandidate.city].name}</strong> is expanded next because it has the lowest f(n) in the queue.
                        </p>
                      </>
                    ) : (
                      <p className={styles.choiceText}>No city remains to compare.</p>
                    )}

                    <div className={styles.tableScroll}>
                      <table className={styles.queueTable}>
                        <caption className={styles.srOnly}>A star queue after expanding {cityName}</caption>
                        <thead>
                          <tr>
                            <th scope="col">City</th>
                            <th scope="col">g</th>
                            <th scope="col">h</th>
                            <th scope="col">f</th>
                            <th scope="col">Decision</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedFrontier.map((candidate) => {
                            const isChosen = candidate.city === chosenNextId;
                            return (
                              <tr key={candidate.city} className={isChosen ? styles.chosenRow : undefined}>
                                <th scope="row">{romaniaGraph.cities[candidate.city].name}</th>
                                <td>{candidate.cost.toFixed(1)}</td>
                                <td>
                                  <Link
                                    className={styles.heuristicLink}
                                    href={`/kirchhoff-matrix?start=${candidate.city}&goal=${explanation.goal}&routeStart=${explanation.start}&decision=${traceIndex}` }
                                    aria-label={`Show how h(${romaniaGraph.cities[candidate.city].name}) is calculated`}
                                  >
                                    {(candidate.priority - candidate.cost).toFixed(2)}
                                  </Link>
                                </td>
                                <td><strong>{candidate.priority.toFixed(2)}</strong></td>
                                <td>{isChosen ? "picked next" : "waits"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className={styles.tieNote}>Ties are resolved by lower g(n), then city order.</p>
                  </div>
                </div>

                <section className={styles.balanceBlock} aria-labelledby={`balance-${traceIndex}`}>
                  <div className={styles.balanceIntro}>
                    <h4 id={`balance-${traceIndex}`}>Check Kirchhoff&apos;s law at {cityName}</h4>
                    <p>
                      Add the signed current on every connected road. It should equal {expectedCurrent} A at this city.
                    </p>
                    <p className={styles.balanceFormula} role="math">Σ<sub>j</sub> c<sub>ij</sub>(V<sub>i</sub> − V<sub>j</sub>) = I<sub>i</sub> = {currentSum.toFixed(3)} A</p>
                  </div>
                  <div className={styles.tableScroll}>
                    <table className={styles.balanceTable}>
                      <caption className={styles.srOnly}>Current balance at {cityName}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Road to</th>
                          <th scope="col">G</th>
                          <th scope="col">V<sub>i</sub> − V<sub>j</sub></th>
                          <th scope="col">G(V<sub>i</sub> − V<sub>j</sub>)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRows.map((row) => (
                          <tr key={row.neighborId}>
                            <th scope="row">{romaniaGraph.cities[row.neighborId].name}</th>
                            <td>{row.conductance.toFixed(5)}</td>
                            <td>{row.voltageDifference.toFixed(3)}</td>
                            <td>{row.current.toFixed(3)} A</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row" colSpan={3}>Total current</th>
                          <td><strong>{currentSum.toFixed(3)} A</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className={balances ? styles.balanceOk : styles.balanceRounded}>
                    Expected {expectedCurrent} A — {balances ? "balances" : "difference is rounding"}
                  </p>
                </section>
              </article>
            );
          })}
        </div>

        <section className={styles.routeResult} aria-labelledby="route-result-title">
          <div>
            <h3 id="route-result-title">Destination reached</h3>
            <p>{pathNames}</p>
          </div>
          <strong>{search.astar.cost} km</strong>
        </section>
      </section>
    </div>
  );
}
