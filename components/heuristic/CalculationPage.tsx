"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { HeuristicExplanation } from "../../lib/types";
import { explainCurrentFlow } from "../../lib/wasm/client";
import styles from "../../app/heuristic-steps/page.module.css";

function cityParam(value: string | null) {
  if (value === null || value.trim() === "") return null;
  const city = Number(value);
  return Number.isInteger(city) && city >= 0 && city < romaniaGraph.cities.length ? city : null;
}

type Props = {
  title: string;
  intro: string;
  current: "kirchhoff-matrix" | "heuristic-steps";
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
  const query = valid ? `?start=${start}&goal=${goal}` : "";
  const activeResult = result?.key === key ? result : null;
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.headerIntro}>{intro}</p>
        </div>
        <nav className={styles.nav} aria-label="Calculation pages">
          <Link href="/">← Back to map</Link>
          <Link href={`/heuristic-summary${query}`}>How it’s calculated</Link>
          <Link href={`/kirchhoff-matrix${query}`} aria-current={current === "kirchhoff-matrix" ? "page" : undefined}>Kirchhoff matrix</Link>
          <Link href={`/heuristic-steps${query}`} aria-current={current === "heuristic-steps" ? "page" : undefined}>Matrix elimination</Link>
        </nav>
      </header>
      {!valid ? <p className={styles.empty}>Choose a starting point and a destination on the map first, then come back here.</p>
        : activeResult?.error ? <p className={styles.errorText} role="alert">Could not calculate: {activeResult.error}. Reload this page to try again.</p>
        : activeResult?.explanation ? <div key={key}>{children(activeResult.explanation)}</div>
        : <p className={styles.empty} role="status">Preparing calculation…</p>}
    </main>
  );
}
