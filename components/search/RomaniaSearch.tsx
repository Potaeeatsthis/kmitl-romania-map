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
          <a
            className={styles.repoLink}
            href="https://github.com/Potaeeatsthis/kmitl-romania-map"
            target="_blank"
            rel="noreferrer"
            aria-label="Source code on GitHub"
            title="Source code on GitHub"
          >
            <svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true" focusable="false">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
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
