"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import MapLegend from "./MapLegend";
import PlaybackControls from "./PlaybackControls";
import RoutePlanner from "./RoutePlanner";
import SearchMap from "./SearchMap";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./RomaniaSearch.module.css";

const THEME_STORAGE_KEY = "romania-search-theme";

type ColorTheme = "light" | "dark";

function isColorTheme(value: string | null | undefined): value is ColorTheme {
  return value === "light" || value === "dark";
}

function applyDocumentTheme(theme: ColorTheme, persist: boolean) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  if (!persist) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The visual theme still works when storage is unavailable.
  }
}

export default function RomaniaSearch({ headerAction }: { headerAction?: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>("light");
  const [isPlaybackMinimized, setIsPlaybackMinimized] = useState(false);
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const reset = useSearchStore((state) => state.reset);
  const showReset = startCity !== null || destinationCity !== null;

  useEffect(() => {
    let storedTheme: string | null = null;
    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Fall back to the document or system preference.
    }

    const documentTheme = document.documentElement.dataset.theme;
    const prefersDark = typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = isColorTheme(storedTheme)
      ? storedTheme
      : isColorTheme(documentTheme)
        ? documentTheme
        : prefersDark
          ? "dark"
          : "light";

    setTheme(initialTheme);
    applyDocumentTheme(initialTheme, false);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyDocumentTheme(nextTheme, true);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">R</span>
          <div>
            <h1 className={styles.title}>Romania search</h1>
            <p className={styles.productTag}>RUST / WASM TRACE</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.themeToggle}
            type="button"
            onClick={handleThemeToggle}
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className={styles.themeGlyph} aria-hidden="true">★</span>
          </button>
          {headerAction}
        </div>
      </header>

      <section
        className={styles.content}
        data-playback-expanded={!isPlaybackMinimized}
      >
        <SearchMap />
        <RoutePlanner />
        <MapLegend />
        {showReset && (
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
