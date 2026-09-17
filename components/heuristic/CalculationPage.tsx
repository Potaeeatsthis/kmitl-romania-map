"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import { explainCurrentFlow } from "../../lib/wasm/client";
import CalculationStepper from "./CalculationStepper";
import styles from "../../app/heuristic-steps/page.module.css";

function cityParam(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const city = Number(value);
  return Number.isInteger(city) && city >= 0 && city < romaniaGraph.cities.length ? city : null;
}

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
  const start = cityParam(params.get("start"));
  const goal = cityParam(params.get("goal"));
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
  const routeStart = cityParam(params.get("routeStart"));
  const rawDecision = params.get("decision");
  const decision = rawDecision !== null && /^\d+$/.test(rawDecision) && Number.isSafeInteger(Number(rawDecision)) ? Number(rawDecision) : null;
  const hasContext = routeStart !== null && decision !== null;
  const query = valid ? `?start=${start}&goal=${goal}${hasContext ? `&routeStart=${routeStart}&decision=${decision}` : ""}` : "";
  const summaryHref = valid ? `/heuristic-summary?start=${routeStart ?? start}&goal=${goal}${hasContext ? `#decision-${decision}` : ""}` : "/heuristic-summary";
  const activeResult = result?.key === key ? result : null;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.headerIntro}>{intro}</p>
        </div>
        <CalculationStepper current={current} query={query} />
      </header>
      {valid && <div className={styles.content}>
        <p className={styles.routeLine}>
          <strong>h({romaniaGraph.cities[start].name} → {romaniaGraph.cities[goal].name})</strong>
          {hasContext && <> · From expansion {decision + 1} of {romaniaGraph.cities[routeStart].name} → {romaniaGraph.cities[goal].name}</>}
          {" · "}<Link href={summaryHref}>{hasContext ? "Back to this A* decision" : "Back to A* decisions"}</Link>
        </p>
      </div>}
      {!valid ? <p className={styles.empty}>Choose a starting point and a destination on the map first, then come back here.</p>
        : activeResult?.error ? <p className={styles.errorText} role="alert">Could not calculate: {activeResult.error}. Reload this page to try again.</p>
        : activeResult?.explanation ? <div key={key}>
          <section className={styles.selectedResult} aria-label="Selected heuristic value">
            <p>h({romaniaGraph.cities[start!].name} → {romaniaGraph.cities[goal!].name}) = <mark className={styles.valueHighlight}>{activeResult.explanation.effective_resistance.toFixed(2)}</mark></p>
            {current !== "heuristic-steps" && <Link href={`/heuristic-steps${query}&view=result`}>See how {activeResult.explanation.effective_resistance.toFixed(2)} is calculated →</Link>}
            <p>This is the final effective resistance, read from the selected city’s diagonal in the inverse grounded matrix.</p>
          </section>
          {children(activeResult.explanation)}
        </div>
        : <p className={styles.empty} role="status">Preparing calculation…</p>}
    </main>
  );
}
