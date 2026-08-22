// components/benchmark/BenchmarkPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import BenchmarkCharts from "./BenchmarkCharts";
import styles from "./BenchmarkPanel.module.css";

const PANEL_TITLE_ID = "benchmark-panel-title";

export default function BenchmarkPanel() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

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
          className={styles.tab}
          onClick={() => setOpen(true)}
          aria-label="Open benchmark results"
        >
          <span className={styles.tabLabel}>RESULTS</span>
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
            <svg
              className={styles.closeIcon}
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
              shapeRendering="crispEdges"
            >
              <path d="M2 2h3v3h2v2H5v2H2v3h3V9h2V7h2v2h2v3h3V9h-3V7H9V5h2V2H8v3H6V2Z" fill="currentColor" />
            </svg>
          </button>
        </div>
        <div className={styles.drawerBody}>
          <BenchmarkCharts />
        </div>
      </aside>
    </>
  );
}
