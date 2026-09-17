"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { parseCityParam, parseDecisionParam } from "../../lib/heuristicQuery";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import { explainCurrentFlow } from "../../lib/wasm/client";
import CalculationStepper from "./CalculationStepper";
import styles from "../../app/heuristic-steps/page.module.css";

type Props = {
  title: string;
  intro: string;
  current: "circuit" | "kirchhoff-matrix" | "heuristic-steps";
  children: (explanation: HeuristicExplanation) => ReactNode;
};

export default function CalculationPage(props: Props) {
  return <Suspense fallback={<p className={styles.empty} role="status">Preparing calculation…</p>}><CalculationContent {...props} /></Suspense>;
}

function CalculationContent({ title, intro, current, children }: Props) {
  const params = useSearchParams();
  const start = parseCityParam(params.get("start"));
  const goal = parseCityParam(params.get("goal"));
  const key = `${start}:${goal}`;
  const [result, setResult] = useState<{ key: string; explanation?: HeuristicExplanation; error?: string } | null>(null);

  useEffect(() => {
    if (start === null || goal === null) return;
    let cancelled = false;
    explainCurrentFlow(start, goal).then(
      (explanation) => { if (!cancelled) setResult({ key, explanation }); },
      (error: unknown) => { if (!cancelled) setResult({ key, error: error instanceof Error ? error.message : "Unknown error" }); },
    );
    return () => { cancelled = true; };
  }, [start, goal, key]);

  const valid = start !== null && goal !== null;
  const routeStart = parseCityParam(params.get("routeStart"));
  const decision = parseDecisionParam(params.get("decision"));
  const hasContext = routeStart !== null && decision !== null;
  const query = valid ? `?start=${start}&goal=${goal}${hasContext ? `&routeStart=${routeStart}&decision=${decision}` : ""}` : "";
  // The summary's `start` is the overall route start (it drives the search), so
  // the city being explained travels in its own `explained` param or the return
  // trip would silently fall back to the route start. With no route context the
  // two coincide and there is nothing to preserve.
  const summaryHref = valid
    ? hasContext
      ? `/heuristic-summary?start=${routeStart}&goal=${goal}&explained=${start}&decision=${decision}#decision-${decision}`
      : `/heuristic-summary?start=${start}&goal=${goal}`
    : "/heuristic-summary";
  const activeResult = result?.key === key ? result : null;
  const explanation = activeResult?.explanation;
  const value = explanation?.effective_resistance.toFixed(2);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.headerIntro}>{intro}</p>
        </div>
        <CalculationStepper current={current} query={query} />
      </header>
      {valid && explanation && (
        <section className={styles.selectedResult} aria-label="Selected heuristic value">
          <div className={styles.resultCopy}>
            <h2 className={styles.resultTitle}>
              h({romaniaGraph.cities[start].name} → {romaniaGraph.cities[goal].name}) ={" "}
              <mark className={styles.valueHighlight}>{value}</mark>
            </h2>
            <p className={styles.resultNote}>
              Final effective resistance, from the selected city’s diagonal in the inverse grounded matrix.
            </p>
          </div>
          <div className={styles.resultNav}>
            {current !== "heuristic-steps" && (
              <Link className={styles.resultAction} href={`/heuristic-steps${query}&view=result`}>
                See how {value} is calculated →
              </Link>
            )}
            {hasContext && (
              <p className={styles.routeContext}>
                Overall route: {romaniaGraph.cities[routeStart].name} → {romaniaGraph.cities[goal].name} · expansion {decision + 1}
              </p>
            )}
            <Link className={styles.backLink} href={summaryHref}>
              {hasContext ? "Back to this A* decision" : "Back to A* decisions"}
            </Link>
          </div>
        </section>
      )}
      {!valid ? <p className={styles.empty}>Choose a starting point and a destination on the map first, then come back here.</p>
        : activeResult?.error ? <p className={styles.errorText} role="alert">Could not calculate: {activeResult.error}. Reload this page to try again.</p>
        : explanation ? <div key={key}>{children(explanation)}</div>
        : <p className={styles.empty} role="status">Preparing calculation…</p>}
    </main>
  );
}
