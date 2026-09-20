// components/benchmark/BenchmarkPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getTimelineLength } from "../../lib/traceSelectors";
import { useSearchStore } from "../../stores/useSearchStore";
import BenchmarkCharts from "./BenchmarkCharts";
import styles from "./BenchmarkPanel.module.css";

const PANEL_TITLE_ID = "benchmark-panel-title";
const PANEL_STATUS_ID = "benchmark-results-status";

type ResultsStatus = "idle" | "processing" | "paused" | "complete";

const statusLabels: Record<ResultsStatus, string> = {
  idle: "Results",
  processing: "Processing…",
  paused: "Paused",
  complete: "View results",
};

export default function BenchmarkPanel() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const data = useSearchStore((state) => state.data);
  const step = useSearchStore((state) => state.step);
  const isPlaying = useSearchStore((state) => state.isPlaying);
  const isLoading = useSearchStore((state) => state.isLoading);
  const timelineLength = getTimelineLength(data);
  const animationComplete = Boolean(
    data && (timelineLength === 0 || step >= timelineLength - 1),
  );
  const status: ResultsStatus = isLoading
    ? "processing"
    : !data
      ? "idle"
      : animationComplete
        ? "complete"
        : isPlaying ? "processing" : "paused";
  const statusClass = status === "processing"
    ? styles.tabProcessing
    : status === "paused"
      ? styles.tabPaused
      : status === "complete" ? styles.tabComplete : "";

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    } else if (wasOpenRef.current) {
      triggerRef.current?.focus();
    }

    wasOpenRef.current = open;
  }, [open]);

  return (
    <>
      {!open && (
        <button
          ref={triggerRef}
          type="button"
          className={`${styles.tab} ${statusClass}`.trim()}
          onClick={() => setOpen(true)}
          aria-label="Open benchmark results"
          aria-describedby={status === "idle" ? undefined : PANEL_STATUS_ID}
        >
          <ResultsIcon />
          <span
            id={PANEL_STATUS_ID}
            className={styles.tabLabel}
            aria-live="polite"
            aria-atomic="true"
          >
            {statusLabels[status]}
          </span>
        </button>
      )}

      <aside
        className={styles.drawer + (open ? " " + styles.drawerOpen : "")}
        aria-hidden={!open}
        aria-labelledby={PANEL_TITLE_ID}
        inert={!open}
      >
        <div className={styles.drawerHeader}>
          <span id={PANEL_TITLE_ID} className={styles.drawerTitle}>RESULTS</span>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close benchmark results"
          >
            <span className={styles.closeGlyph} aria-hidden="true">×</span>
          </button>
        </div>
        <div className={styles.drawerBody}>
          <BenchmarkCharts />
        </div>
      </aside>
    </>
  );
}

function ResultsIcon() {
  return (
    <svg className={styles.tabIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 15V9M10 15V5M16 15v-3" />
    </svg>
  );
}
