"use client";

import { useEffect, useState } from "react";
import BenchmarkCharts from "./BenchmarkCharts";
import styles from "./BenchmarkPanel.module.css";

export default function BenchmarkPanel() {
  // Change to useState(true) if you want it open on first load.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Later, when P4's store exposes an "animation complete" signal, call
  // setOpen(true) here to auto-open the panel when a search finishes.

  return (
    <>
      {!open && (
        <button
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
        aria-label="Benchmark results panel"
      >
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>RESULTS</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={() => setOpen(false)}
            aria-label="Close results panel"
          >
            ×
          </button>
        </div>
        <div className={styles.drawerBody}>
          <BenchmarkCharts variant="stack" />
        </div>
      </aside>
    </>
  );
}
