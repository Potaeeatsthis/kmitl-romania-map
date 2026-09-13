// app/heuristic-summary/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import RouteMap, { computeViewBox } from "../../components/heuristic/RouteMap";
import type { RouteMapMarker } from "../../components/heuristic/RouteMap";
import { buildGroundedKirchhoffSystem } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation, SearchResponse } from "../../lib/types";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";
import styles from "./page.module.css";

const MATRIX_ZERO_EPSILON = 0.00005;

type Edge = {
  neighborId: number;
  distance: number;
  conductance: number;
};

function parseCityParam(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= romaniaGraph.cities.length) {
    return null;
  }
  return parsed;
}

function shortCityName(cityId: number): string {
  return romaniaGraph.cities[cityId].name.slice(0, 3);
}

function formatMatrixValue(value: number): string {
  return Math.abs(value) < MATRIX_ZERO_EPSILON ? "0" : value.toFixed(4);
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
  const circuitHref =
    startCity !== null && destinationCity !== null
      ? `/circuit-flow?start=${startCity}&goal=${destinationCity}`
      : "/circuit-flow";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>How the current-flow heuristic works</h1>
          <p className={styles.headerIntro}>
            Follow the electrical model, its Kirchhoff matrix, and every A* decision from start to destination.
          </p>
        </div>
        <nav className={styles.nav} aria-label="Calculation pages">
          <Link href="/">← Back to map</Link>
          <Link href={stepsHref.replace("heuristic-steps", "kirchhoff-matrix")}>Build the Kirchhoff matrix →</Link>
          <Link href={stepsHref}>See matrix elimination →</Link>
          <Link href={circuitHref}>Circuit view →</Link>
        </nav>
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
  const isTrivialRoute = explanation.start === explanation.goal;
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
  const startRoads = explanation.conductances.filter(
    (edge) => edge.city_a === explanation.start || edge.city_b === explanation.start,
  );
  const matrixExampleTerms = startRoads.map((edge) => `1/${edge.distance}`).join(" + ");
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

      <article className={styles.calculation} aria-label="Current-flow heuristic calculation">
        <section className={styles.conceptSection} aria-labelledby="current-flow-title">
          <div className={styles.conceptLead}>
            <h2 id="current-flow-title">What is a current-flow heuristic?</h2>
            <p>
              It estimates the remaining route cost by treating the road map like an electrical
              circuit. A long road resists current more than a short road, while several possible
              routes act like parallel paths that make the effective resistance smaller.
            </p>
            <p>
              That effective resistance is never greater than the cost of taking one real route,
              so A* can use it as a safe lower-bound estimate h(n).
            </p>
          </div>
          <ol className={styles.conceptSteps}>
            <li><strong>Road distance becomes resistance R.</strong><span>Longer road, larger resistance.</span></li>
            <li><strong>Resistance becomes conductance G = 1/R.</strong><span>Short roads carry more imaginary current.</span></li>
            <li><strong>Inject 1 A and ground the destination.</strong><span>The required start voltage is the effective resistance.</span></li>
          </ol>
        </section>

        <section className={styles.calculationSection} aria-labelledby="build-matrix-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="build-matrix-title">Build the Kirchhoff matrix</h2>
              <p>
                Kirchhoff&apos;s current law says that current entering each city must equal current
                leaving it. The weighted Laplacian records that rule for every city at once.
              </p>
            </div>
            <div className={styles.mainEquation} aria-label="L sub g times V equals I">
              <span>L<sub>g</sub></span>
              <span aria-hidden="true">×</span>
              <span>V</span>
              <span aria-hidden="true">=</span>
              <span>I</span>
            </div>
          </div>

          <dl className={styles.matrixRules}>
            <div>
              <dt>Diagonal</dt>
              <dd>L<sub>ii</sub> = Σ G<sub>ij</sub></dd>
            </div>
            <div>
              <dt>Direct road</dt>
              <dd>L<sub>ij</sub> = −G<sub>ij</sub></dd>
            </div>
            <div>
              <dt>No direct road</dt>
              <dd>L<sub>ij</sub> = 0</dd>
            </div>
          </dl>

          {!isTrivialRoute ? (
            <div className={styles.workedRow}>
              <h3>Example row: {startName}</h3>
              <p className={styles.workedEquation}>
                L<sub>{shortCityName(explanation.start)},{shortCityName(explanation.start)}</sub>
                {" = "}{matrixExampleTerms}{" = "}
                {explanation.laplacian[explanation.start][explanation.start].toFixed(5)}
              </p>
              <p>
                Connected cities receive the matching negative conductance; every other entry is zero.
              </p>
            </div>
          ) : (
            <p className={styles.inlineNote}>
              The start is already the grounded destination, so no current crosses the network and h(n) = 0.
            </p>
          )}

          <div className={styles.matrixHeader}>
            <div>
              <h3>Grounded matrix L<sub>g</sub></h3>
              <p>
                {goalName} is removed from the rows and columns, fixing V<sub>{shortCityName(explanation.goal)}</sub> = 0.
              </p>
            </div>
            <div className={styles.matrixLegend} aria-label="Matrix color key">
              <span className={styles.legendDiagonal}>diagonal sum</span>
              <span className={styles.legendRoad}>direct road</span>
              <span className={styles.legendZero}>no road</span>
            </div>
          </div>

          <div
            className={styles.matrixScroll}
            role="region"
            aria-label="Scrollable grounded Kirchhoff matrix"
            tabIndex={0}
          >
            <table className={styles.matrixTable}>
              <caption className={styles.srOnly}>
                Grounded Kirchhoff matrix. Rows and columns are cities, excluding grounded city {goalName}.
              </caption>
              <thead>
                <tr>
                  <th className={styles.cornerCell} scope="col">row \ col</th>
                  {system.cityIds.map((cityId, columnIndex) => (
                    <th
                      key={cityId}
                      className={columnIndex === system.startIndex ? styles.sourceHeader : undefined}
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
                {system.matrix.map((row, rowIndex) => (
                  <tr key={system.cityIds[rowIndex]}>
                    <th
                      className={rowIndex === system.startIndex ? styles.sourceHeader : undefined}
                      scope="row"
                    >
                      <abbr
                        title={romaniaGraph.cities[system.cityIds[rowIndex]].name}
                        aria-label={romaniaGraph.cities[system.cityIds[rowIndex]].name}
                      >
                        {shortCityName(system.cityIds[rowIndex])}
                      </abbr>
                    </th>
                    {row.map((value, columnIndex) => {
                      const classes = [styles.matrixCell];
                      if (rowIndex === columnIndex) classes.push(styles.diagonalCell);
                      else if (Math.abs(value) < MATRIX_ZERO_EPSILON) classes.push(styles.zeroCell);
                      else classes.push(styles.roadCell);
                      if (rowIndex === system.startIndex || columnIndex === system.startIndex) {
                        classes.push(styles.sourceAxisCell);
                      }

                      return (
                        <td
                          key={system.cityIds[columnIndex]}
                          className={classes.join(" ")}
                          title={`${romaniaGraph.cities[system.cityIds[rowIndex]].name} × ${romaniaGraph.cities[system.cityIds[columnIndex]].name}: ${value.toFixed(6)}`}
                        >
                          {formatMatrixValue(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.scrollHint}>Scroll horizontally to inspect every city column.</p>
        </section>

        <section className={styles.solveSection} aria-labelledby="solve-system-title">
          <div>
            <h2 id="solve-system-title">Solve L<sub>g</sub>V = I</h2>
            <p>
              Put 1 A into {startName}, put 0 A into every other ungrounded city, and solve for V.
              {isTrivialRoute ? " No solve is needed because start and destination are the same." : ""}
            </p>
          </div>
          <dl className={styles.solveSummary}>
            <div>
              <dt>Current vector I</dt>
              <dd>I<sub>{shortCityName(explanation.start)}</sub> = {isTrivialRoute ? "0" : "1"}; all others = 0</dd>
            </div>
            <div>
              <dt>Ground condition</dt>
              <dd>V<sub>{shortCityName(explanation.goal)}</sub> = 0</dd>
            </div>
            <div>
              <dt>Start voltage</dt>
              <dd>V<sub>{shortCityName(explanation.start)}</sub> = {explanation.effective_resistance.toFixed(4)}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.resultSection} aria-labelledby="heuristic-result-title">
          <div>
            <h2 id="heuristic-result-title">The voltage becomes h(n)</h2>
            <p>
              Because the injected current is exactly 1 A, the start voltage equals the effective resistance.
            </p>
          </div>
          <div className={styles.resultFormula}>
            h({shortCityName(explanation.start)}) = R<sub>eff</sub> ={" "}
            <strong>{explanation.effective_resistance.toFixed(4)}</strong>
          </div>
          <p className={styles.boundCheck}>
            {explanation.effective_resistance.toFixed(2)} ≤ {search.ucs.cost} km for this route. The project also verifies
            admissibility and consistency across every city pair.
          </p>
        </section>
      </article>

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
              <article className={styles.nodeCard} key={`${cityId}-${traceIndex}`}>
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
                          <div><span>h(n)</span><strong>{(chosenCandidate.priority - chosenCandidate.cost).toFixed(2)}</strong><small>estimate</small></div>
                          <b aria-hidden="true">=</b>
                          <div className={styles.totalScore}><span>f(n)</span><strong>{chosenCandidate.priority.toFixed(2)}</strong><small>priority</small></div>
                        </div>
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
                                <td>{(candidate.priority - candidate.cost).toFixed(2)}</td>
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
