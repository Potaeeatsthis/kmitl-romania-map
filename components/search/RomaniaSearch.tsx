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
            <svg
              viewBox="0 0 16 16"
              width="24"
              height="24"
              shapeRendering="crispEdges"
              aria-hidden="true"
              focusable="false"
            >
              {/* Pixel-art GitHub mark: one path draws the disc and the octocat,
                  and the even-odd rule turns the octocat into a hole, so it tracks
                  whatever sits behind the icon instead of pinning a dark color. */}
              <path className={styles.repoDisc} fillRule="evenodd" d="M5 0h6v1h-6ZM3 1h10v1h-10ZM2 2h12v1h-12ZM1 3h14v1h-14ZM1 4h14v1h-14ZM0 5h16v1h-16ZM0 6h16v1h-16ZM0 7h16v1h-16ZM0 8h16v1h-16ZM0 9h16v1h-16ZM0 10h16v1h-16ZM1 11h14v1h-14ZM1 12h14v1h-14ZM2 13h12v1h-12ZM3 14h10v1h-10ZM5 15h6v1h-6ZM4 2h2v1h-2ZM10 2h2v1h-2ZM4 3h2v1h-2ZM10 3h2v1h-2ZM4 4h8v1h-8ZM3 5h10v1h-10ZM3 6h10v1h-10ZM3 7h10v1h-10ZM4 8h8v1h-8ZM5 9h6v1h-6ZM3 10h1v1h-1ZM5 10h6v1h-6ZM3 11h8v1h-8ZM6 12h4v1h-4ZM6 13h4v1h-4ZM6 14h4v1h-4Z" />
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
