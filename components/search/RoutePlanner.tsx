"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./RoutePlanner.module.css";

// "auto" is the first-paint state: the desktop panel is shown, while the CSS
// breakpoint swaps in the compact launcher on phones. Keeping it a CSS decision
// avoids a server/client matchMedia mismatch during hydration. Once the visitor
// acts the mode becomes explicit and behaves the same at every width.
type PlannerMode = "auto" | "open" | "closed";

export default function RoutePlanner() {
  const [mode, setMode] = useState<PlannerMode>("auto");
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const isLoading = useSearchStore((state) => state.isLoading);
  const error = useSearchStore((state) => state.error);
  const setCity = useSearchStore((state) => state.setCity);
  const run = useSearchStore((state) => state.run);

  const showPanel = mode !== "closed";
  const showLauncher = mode !== "open";

  return (
    <>
      {showLauncher && (
        <button
          className={styles.routeLauncher}
          data-auto={mode === "auto" ? "true" : undefined}
          type="button"
          onClick={() => setMode("open")}
          aria-expanded="false"
          aria-controls="route-planner"
        >
          <RouteIcon />
          Route
        </button>
      )}

      {showPanel && (
        <aside
          className={styles.panel}
          data-auto={mode === "auto" ? "true" : undefined}
          id="route-planner"
        >
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>ROUTE</p>
              <h2>Choose your route</h2>
            </div>
            <button
              className={styles.collapseButton}
              type="button"
              onClick={() => setMode("closed")}
              aria-label="Hide route planner"
              title="Hide route planner"
            >
              <CollapseIcon />
            </button>
          </div>

          <div className={styles.routeSelector}>
            <CitySearch
              label="STARTING POINT"
              selectedCity={startCity}
              onFocus={() => useSearchStore.getState().setSelecting("start")}
              onSelect={(cityId) => setCity("start", cityId)}
            />
            <CitySearch
              label="DESTINATION"
              selectedCity={destinationCity}
              onFocus={() => useSearchStore.getState().setSelecting("destination")}
              onSelect={(cityId) => setCity("destination", cityId)}
            />
            <p className={styles.mapHint}>Map: choose a starting point, then a destination.</p>
            <button className={styles.runButton} type="button" onClick={() => void run()} disabled={isLoading}>
              {isLoading ? "Running Rust…" : "Run search"}
            </button>
          </div>

          {error && <p className={styles.errorMessage} role="alert">{error}</p>}
        </aside>
      )}
    </>
  );
}

function CitySearch({
  label,
  selectedCity,
  onFocus,
  onSelect,
}: {
  label: string;
  selectedCity: number | null;
  onFocus: () => void;
  onSelect: (cityId: number) => void;
}) {
  const listId = useId();
  const selected = selectedCity !== null ? romaniaGraph.cities[selectedCity] : undefined;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const normalizedQuery = normalizeCityName(query);
  const matches = useMemo(
    () => romaniaGraph.cities.filter((city) =>
      normalizedQuery === "" || normalizeCityName(city.name).startsWith(normalizedQuery),
    ),
    [normalizedQuery],
  );
  const listboxOpen = isOpen && matches.length > 0;
  const emptyStatusId = listId + "-empty";

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  const choose = (cityId: number) => {
    onSelect(cityId);
    setQuery(romaniaGraph.cities[cityId].name);
    setIsOpen(false);
    setActiveIndex(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => matches.length ? (index + 1) % matches.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => matches.length ? (index - 1 + matches.length) % matches.length : 0);
    } else if (event.key === "Enter" && isOpen && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex].id);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selected?.name ?? "");
    }
  };

  return (
    <div className={styles.citySearch}>
      <label htmlFor={`${listId}-input`}>{label}</label>
      <input
        id={`${listId}-input`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxOpen ? listId : undefined}
        aria-expanded={listboxOpen}
        aria-activedescendant={listboxOpen && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined}
        aria-describedby={isOpen && matches.length === 0 ? emptyStatusId : undefined}
        value={query}
        placeholder="Type a city…"
        autoComplete="off"
        spellCheck={false}
        onFocus={(event) => {
          onFocus();
          event.currentTarget.select();
          setIsOpen(true);
        }}
        onBlur={() => {
          setIsOpen(false);
          setQuery(selected?.name ?? "");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {listboxOpen && (
        <div className={styles.searchResults} id={listId} role="listbox">
          {matches.map((city, index) => (
            <div
              key={city.id}
              id={`${listId}-${city.id}`}
              role="option"
              aria-selected={city.id === selectedCity}
              className={index === activeIndex ? styles.activeOption : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(city.id)}
            >
              {city.name}
            </div>
          ))}
        </div>
      )}
      {isOpen && matches.length === 0 && (
        <div className={styles.searchResults}>
          <p className={styles.noResults} id={emptyStatusId} role="status">
            No city starts with “{query}”.
          </p>
        </div>
      )}
    </div>
  );
}

function normalizeCityName(value: string) {
  return value.toLocaleLowerCase("en").trim();
}

function CollapseIcon() {
  return <svg className={styles.smallIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 10h10" /></svg>;
}

function RouteIcon() {
  return (
    <svg className={styles.buttonIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="5" cy="5" r="2.25" />
      <circle cx="15" cy="15" r="2.25" />
      <path d="M6.6 6.6 13.4 13.4" />
    </svg>
  );
}
