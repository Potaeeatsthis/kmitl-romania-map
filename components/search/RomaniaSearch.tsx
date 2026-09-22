"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import MapLegend from "./MapLegend";
import PlaybackControls from "./PlaybackControls";
import RoutePlanner, { type PlannerMode } from "./RoutePlanner";
import SearchMap from "./SearchMap";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./RomaniaSearch.module.css";

export default function RomaniaSearch({ headerAction }: { headerAction?: ReactNode }) {
  const [isPlaybackMinimized, setIsPlaybackMinimized] = useState(false);
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("auto");
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const reset = useSearchStore((state) => state.reset);
  const showReset = startCity !== null || destinationCity !== null;

  return (
    // The homepage is a dark-only surface, scoped to this subtree. It never
    // reads or writes the document theme, so other routes keep their own
    // light/dark behavior (see public/theme-boot.js).
    <main className={styles.page} data-theme="dark">
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg
              className={styles.brandRoute}
              viewBox="0 0 30 24"
              width="40"
              height="32"
              fill="none"
              focusable="false"
            >
              <path
                d="M4 4H15V20H26"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="2" y="2" width="4" height="4" fill="currentColor" />
              <rect x="24" y="18" width="4" height="4" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h1 className={styles.title}>Romania Search</h1>
            <p className={styles.productTag}>PATHFINDING VISUALIZER</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          {headerAction}
        </div>
      </header>

      <section
        className={styles.content}
        data-playback-expanded={!isPlaybackMinimized}
      >
        <SearchMap />
        <RoutePlanner mode={plannerMode} onModeChange={setPlannerMode} />
        <MapLegend />
        {/* While the route planner is explicitly open it carries its own clear
            action, so the floating button would only sit behind the panel. */}
        {showReset && plannerMode !== "open" && (
          <button
            className={styles.resetButton}
            type="button"
            onClick={reset}
            aria-label="Clear selection"
            title="Clear Selection"
          >
            Clear Selection
          </button>
        )}
        <PlaybackControls
          minimized={isPlaybackMinimized}
          onMinimizedChange={setIsPlaybackMinimized}
        />
      </section>
    </main>
  );
}
