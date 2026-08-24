// components/sample/SampleGraphDemo.tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { countyOutlines } from "../../lib/countyOutlines";
import type { DiscoveredNode } from "../../lib/types";
import { romaniaGraph } from "../../lib/romaniaGraph";
import {
  getTimelineLength,
  getTraceFrame,
  getExpandedCities,
  getFrontierCities,
  getFinalPath,
} from "../../lib/traceSelectors";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./SampleGraphDemo.module.css";

const FRAME_DURATION_MS = 850;
const MAP_VIEW_BOX = { x: 120, y: 50, width: 900, height: 650 } as const;
const MAP_MIN_ZOOM = 1;
const MAP_MAX_ZOOM = 2;
const MAP_ZOOM_STEP = 0.25;
const TRACKPAD_SCROLL_ZOOM_SENSITIVITY = 0.0025;
const TRACKPAD_PINCH_ZOOM_SENSITIVITY = 0.01;
const MAX_WHEEL_ZOOM_EXPONENT = 0.35;
const THEME_STORAGE_KEY = "romania-search-theme";

type ColorTheme = "light" | "dark";
type MapTouchPoint = { x: number; y: number };
type MapViewport = { zoom: number; centerX: number; centerY: number };
type PinchGesture = { startDistance: number; startViewport: MapViewport };
type PanGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: MapViewport;
  unitsPerPixel: number;
  moved: boolean;
};

const INITIAL_MAP_VIEWPORT: MapViewport = {
  zoom: MAP_MIN_ZOOM,
  centerX: MAP_VIEW_BOX.x + MAP_VIEW_BOX.width / 2,
  centerY: MAP_VIEW_BOX.y + MAP_VIEW_BOX.height / 2,
};

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

function clampMapZoom(zoom: number) {
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom));
}

function clampMapViewport(viewport: MapViewport): MapViewport {
  const zoom = clampMapZoom(viewport.zoom);
  const width = MAP_VIEW_BOX.width / zoom;
  const height = MAP_VIEW_BOX.height / zoom;
  const minCenterX = MAP_VIEW_BOX.x + width / 2;
  const maxCenterX = MAP_VIEW_BOX.x + MAP_VIEW_BOX.width - width / 2;
  const minCenterY = MAP_VIEW_BOX.y + height / 2;
  const maxCenterY = MAP_VIEW_BOX.y + MAP_VIEW_BOX.height - height / 2;

  return {
    zoom,
    centerX: Math.min(maxCenterX, Math.max(minCenterX, viewport.centerX)),
    centerY: Math.min(maxCenterY, Math.max(minCenterY, viewport.centerY)),
  };
}

function getMapViewBox(viewport: MapViewport) {
  const width = MAP_VIEW_BOX.width / viewport.zoom;
  const height = MAP_VIEW_BOX.height / viewport.zoom;
  const x = viewport.centerX - width / 2;
  const y = viewport.centerY - height / 2;
  const values = [x, y, width, height].map((value) => Number(value.toFixed(2)));

  return values.join(" ");
}

function getTouchDistance([first, second]: MapTouchPoint[]) {
  if (!first || !second) return 0;
  return Math.hypot(second.x - first.x, second.y - first.y);
}

const labelOffsets: Record<number, { x: number; y: number }> = {
  0: { x: -21, y: -5 },   1: { x: -20, y: -10 },  2: { x: -3, y: -22 },
  3: { x: 7, y: -21 },    4: { x: -22, y: 16 },   5: { x: 13, y: -18 },
  6: { x: -34, y: 4 },   7: { x: -14, y: 19 },   8: { x: 3, y: 24 },
  9: { x: 30, y: -21 },   10: { x: 12, y: -20 },  11: { x: 11, y: -21 },
  12: { x: 34, y: 20 },   13: { x: -4, y: 23 },   14: { x: -20, y: -15 },
  15: { x: 11, y: -21 },  16: { x: 13, y: 17 },   17: { x: 32, y: -10 },
  18: { x: 12, y: -18 },  19: { x: -32, y: 0 },
};

export default function SampleGraphDemo({ headerAction }: { headerAction?: ReactNode }) {
  const [isRouteOpen, setIsRouteOpen] = useState(true);
  const [theme, setTheme] = useState<ColorTheme>("light");
  const [isPlaybackMinimized, setIsPlaybackMinimized] = useState(false);
  const [mapViewport, setMapViewport] = useState<MapViewport>(INITIAL_MAP_VIEWPORT);
  const [isMapPanning, setIsMapPanning] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null);
  const mapTouchesRef = useRef(new Map<number, MapTouchPoint>());
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const suppressMapClickUntilRef = useRef(0);
  const data = useSearchStore((state) => state.data);
  const step = useSearchStore((state) => state.step);
  const isPlaying = useSearchStore((state) => state.isPlaying);
  const speed = useSearchStore((state) => state.speed);
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const selecting = useSearchStore((state) => state.selecting);
  const isLoading = useSearchStore((state) => state.isLoading);
  const error = useSearchStore((state) => state.error);
  const setCity = useSearchStore((state) => state.setCity);
  const run = useSearchStore((state) => state.run);
  const play = useSearchStore((state) => state.play);
  const pause = useSearchStore((state) => state.pause);
  const replay = useSearchStore((state) => state.replay);
  const setStep = useSearchStore((state) => state.setStep);
  const setSpeed = useSearchStore((state) => state.setSpeed);

  const cityById = useMemo(
    () => new Map(romaniaGraph.cities.map((city) => [city.id, city])),
    [],
  );
  const timelineLength = getTimelineLength(data);
  const lastStep = Math.max(0, timelineLength - 1);
  const animationComplete = timelineLength > 0 && step >= lastStep;

  useEffect(() => {
    if (!isPlaying || timelineLength === 0) return;

    if (animationComplete) {
      pause();
      return;
    }

    const timer = window.setTimeout(() => {
      setStep(Math.min(step + 1, lastStep));
    }, FRAME_DURATION_MS / speed);

    return () => window.clearTimeout(timer);
  }, [
    animationComplete,
    isPlaying,
    lastStep,
    pause,
    setStep,
    speed,
    step,
    timelineLength,
  ]);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleTrackpadZoom = (event: WheelEvent) => {
      if (event.deltaY === 0) return;

      event.preventDefault();
      const deltaModeMultiplier = event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? window.innerHeight
          : 1;
      const delta = event.deltaY * deltaModeMultiplier;
      const sensitivity = event.ctrlKey
        ? TRACKPAD_PINCH_ZOOM_SENSITIVITY
        : TRACKPAD_SCROLL_ZOOM_SENSITIVITY;
      const exponent = Math.max(
        -MAX_WHEEL_ZOOM_EXPONENT,
        Math.min(MAX_WHEEL_ZOOM_EXPONENT, -delta * sensitivity),
      );

      setMapViewport((viewport) => clampMapViewport({
        ...viewport,
        zoom: viewport.zoom * Math.exp(exponent),
      }));
    };

    map.addEventListener("wheel", handleTrackpadZoom, { passive: false });
    return () => map.removeEventListener("wheel", handleTrackpadZoom);
  }, []);

  const ucsFrame = getTraceFrame(data, "ucs", step);
  const astarFrame = getTraceFrame(data, "astar", step);

  const ucsExpanded = getExpandedCities(data, "ucs", step);
  const astarExpanded = getExpandedCities(data, "astar", step);
  const ucsFrontier = getFrontierCities(ucsFrame);
  const astarFrontier = getFrontierCities(astarFrame);
  const ucsComplete = Boolean(data && step >= data.ucs.trace.length - 1);
  const astarComplete = Boolean(data && step >= data.astar.trace.length - 1);
  const finalPath = getFinalPath(
    data,
    ucsComplete,
    astarComplete,
  );
  const progress = timelineLength > 0 ? ((Math.min(step, lastStep) + 1) / timelineLength) * 100 : 0;

  const headerStatus = isLoading
    ? "Running Rust search…"
    : !data
      ? "Choose route · Run search"
      : animationComplete
        ? "Animation complete · Replay"
        : `Frame ${step + 1} / ${timelineLength}`;
  const mapZoom = mapViewport.zoom;
  const mapViewBox = getMapViewBox(mapViewport);

  const beginMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewWidth = MAP_VIEW_BOX.width / mapZoom;
    const viewHeight = MAP_VIEW_BOX.height / mapZoom;
    const renderedScale = Math.min(rect.width / viewWidth, rect.height / viewHeight);
    if (!Number.isFinite(renderedScale) || renderedScale <= 0) return;

    panGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startViewport: mapViewport,
      unitsPerPixel: 1 / renderedScale,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      mapTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture?.(event.pointerId);

      if (mapTouchesRef.current.size === 2) {
        const startDistance = getTouchDistance(Array.from(mapTouchesRef.current.values()));
        if (startDistance > 0) {
          pinchGestureRef.current = { startDistance, startViewport: mapViewport };
          panGestureRef.current = null;
          setIsMapPanning(false);
          suppressMapClickUntilRef.current = Date.now() + 500;
          event.preventDefault();
        }
      } else if (mapZoom > MAP_MIN_ZOOM) {
        beginMapPan(event);
      }
      return;
    }

    if (event.button !== 0 || mapZoom <= MAP_MIN_ZOOM) return;
    beginMapPan(event);
  };

  const handleMapPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch" && mapTouchesRef.current.has(event.pointerId)) {
      mapTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const pinchGesture = pinchGestureRef.current;
    if (pinchGesture && mapTouchesRef.current.size >= 2) {
      const distance = getTouchDistance(Array.from(mapTouchesRef.current.values()));
      if (distance <= 0) return;

      setMapViewport(clampMapViewport({
        ...pinchGesture.startViewport,
        zoom: pinchGesture.startViewport.zoom * (distance / pinchGesture.startDistance),
      }));
      suppressMapClickUntilRef.current = Date.now() + 500;
      event.preventDefault();
      return;
    }

    const panGesture = panGestureRef.current;
    if (!panGesture || panGesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - panGesture.startX;
    const deltaY = event.clientY - panGesture.startY;
    if (!panGesture.moved && Math.hypot(deltaX, deltaY) <= 4) return;

    panGesture.moved = true;
    setIsMapPanning(true);
    setMapViewport(clampMapViewport({
      zoom: panGesture.startViewport.zoom,
      centerX: panGesture.startViewport.centerX - deltaX * panGesture.unitsPerPixel,
      centerY: panGesture.startViewport.centerY - deltaY * panGesture.unitsPerPixel,
    }));
    suppressMapClickUntilRef.current = Date.now() + 500;
    event.preventDefault();
  };

  const handleMapPointerEnd = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      mapTouchesRef.current.delete(event.pointerId);
      if (mapTouchesRef.current.size < 2) {
        pinchGestureRef.current = null;
      }
    }

    const panGesture = panGestureRef.current;
    if (panGesture?.pointerId === event.pointerId) {
      if (panGesture.moved) suppressMapClickUntilRef.current = Date.now() + 500;
      panGestureRef.current = null;
      setIsMapPanning(false);
    }

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleMapClickCapture = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (Date.now() >= suppressMapClickUntilRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  };

  const updateMapZoom = (delta: number) => {
    setMapViewport((viewport) => clampMapViewport({
      ...viewport,
      zoom: viewport.zoom + delta,
    }));
  };

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyDocumentTheme(nextTheme, true);
  };

  const mapClassName = [
    styles.map,
    mapZoom > MAP_MIN_ZOOM ? styles.mapPannable : "",
    isMapPanning ? styles.mapPanning : "",
  ].filter(Boolean).join(" ");

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
          {animationComplete ? (
            <button className={styles.headerStatusButton} type="button" onClick={replay}>
              {headerStatus}
            </button>
          ) : (
            <p className={styles.headerStatus} aria-live="polite">
              {headerStatus}
            </p>
          )}
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

      <section className={styles.content}>
        <div className={styles.mapPanel}>
          <svg
            ref={mapRef}
            className={mapClassName}
            viewBox={mapViewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-label="Animated Romania road graph. Selectable cities set the active route field. Pinch on a touchscreen or use a touchpad to zoom, then drag to move the map."
            role="group"
            onPointerDown={handleMapPointerDown}
            onPointerMove={handleMapPointerMove}
            onPointerUp={handleMapPointerEnd}
            onPointerCancel={handleMapPointerEnd}
            onClickCapture={handleMapClickCapture}
          >
            <defs>
              <linearGradient id="shared-label-highlight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--label-ucs)" />
                <stop offset="50%" stopColor="var(--label-ucs)" />
                <stop offset="50%" stopColor="var(--label-astar)" />
                <stop offset="100%" stopColor="var(--label-astar)" />
              </linearGradient>
            </defs>

            <g className={styles.countryOutline} aria-hidden="true">
              {countyOutlines.map((path, index) => (
                <path key={index} d={path} />
              ))}
            </g>
            <g className={styles.countyLines} aria-hidden="true">
              {countyOutlines.map((path, index) => (
                <path key={index} d={path} />
              ))}
            </g>

            <g className={styles.roads} aria-hidden="true">
              {romaniaGraph.roads.map(([from, to]) => {
                const roadStart = cityById.get(from);
                const roadEnd = cityById.get(to);
                if (!roadStart || !roadEnd) return null;
                return (
                  <g key={`${from}-${to}`}>
                    <line
                      className={styles.roadCasing}
                      x1={roadStart.x}
                      y1={roadStart.y}
                      x2={roadEnd.x}
                      y2={roadEnd.y}
                    />
                    <line
                      className={styles.roadCenter}
                      x1={roadStart.x}
                      y1={roadStart.y}
                      x2={roadEnd.x}
                      y2={roadEnd.y}
                    />
                  </g>
                );
              })}
            </g>

            {ucsFrame && (
              <SearchTreeLines
                discovered={ucsFrame.discovered}
                cityById={cityById}
                className={styles.ucsTree}
                offset={-2}
              />
            )}
            {astarFrame && (
              <SearchTreeLines
                discovered={astarFrame.discovered}
                cityById={cityById}
                className={styles.astarTree}
                offset={2}
              />
            )}
            {ucsFrame && (
              <ExpandedTreeLines
                discovered={ucsFrame.discovered}
                expanded={ucsExpanded}
                cityById={cityById}
                className={styles.ucsPath}
                offset={-3}
              />
            )}
            {astarFrame && (
              <ExpandedTreeLines
                discovered={astarFrame.discovered}
                expanded={astarExpanded}
                cityById={cityById}
                className={styles.astarPath}
                offset={3}
              />
            )}
            {ucsComplete && data && (
              <PathLines path={data.ucs.path} cityById={cityById} className={styles.ucsPath} offset={-3} />
            )}
            {astarComplete && data && (
              <PathLines path={data.astar.path} cityById={cityById} className={styles.astarPath} offset={3} />
            )}

            <g className={styles.roadLabels} aria-hidden="true">
              {romaniaGraph.roads.map(([from, to, distance]) => {
                const roadStart = cityById.get(from);
                const roadEnd = cityById.get(to);
                if (!roadStart || !roadEnd) return null;
                const position = roadLabelPosition(roadStart, roadEnd);
                return (
                  <text key={`${from}-${to}`} x={position.x} y={position.y}>
                    {distance}
                  </text>
                );
              })}
            </g>

            {romaniaGraph.cities.map((city) => {
              const offset = labelOffsets[city.id] ?? { x: 0, y: 22 };
              const labelX = city.x + offset.x;
              const labelY = city.y + offset.y;
              const isTwoLineLabel = city.id === 9;
              const labelWidth = (isTwoLineLabel ? 7 : city.name.length) * 6.6 + 10;
              const ucsLabelHighlighted = ucsFrame
                ? ucsComplete
                  ? Boolean(data?.ucs.path.includes(city.id))
                  : ucsFrame.expanded_city === city.id
                : false;
              const astarLabelHighlighted = astarFrame
                ? astarComplete
                  ? Boolean(data?.astar.path.includes(city.id))
                  : astarFrame.expanded_city === city.id
                : false;
              const labelHighlightClass = ucsLabelHighlighted && astarLabelHighlighted
                ? styles.labelBoth
                : astarLabelHighlighted
                  ? styles.labelAstar
                  : ucsLabelHighlighted
                    ? styles.labelUcs
                    : "";
              const inUcsFrontier = ucsFrontier.has(city.id);
              const inAstarFrontier = astarFrontier.has(city.id);
              const isActive = ucsFrame?.expanded_city === city.id || astarFrame?.expanded_city === city.id;
              const classes = [
                styles.city,
                ucsExpanded.has(city.id) || astarExpanded.has(city.id) ? styles.expanded : "",
                inUcsFrontier && inAstarFrontier
                  ? styles.frontierBoth
                  : inUcsFrontier
                    ? styles.frontierUcs
                    : inAstarFrontier
                      ? styles.frontierAstar
                      : "",
                isActive ? styles.active : "",
                finalPath.has(city.id) ? styles.path : "",
                city.id === startCity ? styles.startCity : "",
                city.id === destinationCity ? styles.destinationCity : "",
              ].filter(Boolean).join(" ");

              const chooseCity = () => {
                const selectedField = selecting;
                setCity(selectedField, city.id);

                if (selectedField === "destination") {
                  void useSearchStore.getState().run();
                }
              };
              const handleCityKeyDown = (event: KeyboardEvent<SVGGElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  chooseCity();
                }
              };

              return (
                <g
                  key={city.id}
                  className={classes}
                  role="button"
                  tabIndex={0}
                  aria-label={`Choose ${city.name} as ${selecting === "start" ? "starting point" : "destination"}`}
                  onClick={chooseCity}
                  onKeyDown={handleCityKeyDown}
                >
                  {labelHighlightClass && (
                    <rect
                      className={`${styles.cityLabelBackground} ${labelHighlightClass}`}
                      x={labelX - labelWidth / 2}
                      y={labelY - (isTwoLineLabel ? 17 : 13)}
                      width={labelWidth}
                      height={isTwoLineLabel ? 28 : 18}
                      rx="3"
                    />
                  )}
                  <rect className={styles.cityNode} x={city.x - 5} y={city.y - 5} width="10" height="10" rx="2" />
                  <text
                    className={labelHighlightClass ? styles.highlightedCityLabel : undefined}
                    x={labelX}
                    y={labelY}
                  >
                    {city.id === 9 ? (
                      <>
                        <tspan x={labelX} y={labelY - 6}>Rimnicu</tspan>
                        <tspan x={labelX} y={labelY + 6}>Vilcea</tspan>
                      </>
                    ) : city.name}
                  </text>
                </g>
              );
            })}
          </svg>

          <div
            className={styles.zoomControls}
            role="group"
            aria-label={`Map zoom controls, ${Math.round(mapZoom * 100)}%`}
          >
            <button
              className={styles.zoomButton}
              type="button"
              onClick={() => updateMapZoom(MAP_ZOOM_STEP)}
              disabled={mapZoom >= MAP_MAX_ZOOM - 0.001}
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomInIcon />
            </button>
            <button
              className={styles.zoomButton}
              type="button"
              onClick={() => updateMapZoom(-MAP_ZOOM_STEP)}
              disabled={mapZoom <= MAP_MIN_ZOOM + 0.001}
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOutIcon />
            </button>
          </div>

          <details className={styles.legend}>
            <summary><LegendIcon />Map key</summary>
            <div className={styles.legendContent}>
              <Legend className={styles.swatchCity} label="Not discovered" />
              <Legend className={styles.swatchExpanded} label="Expanded" />
              <Legend className={styles.swatchUcs} label="UCS frontier / tree" />
              <Legend className={styles.swatchAstar} label="A* frontier / tree" />
              <Legend className={styles.swatchUcsHighlight} label="UCS city highlight" />
              <Legend className={styles.swatchAstarHighlight} label="A* city highlight" />
              <Legend className={styles.swatchPath} label="Final optimal path" />
            </div>
          </details>
        </div>

        {isRouteOpen ? (
          <aside className={styles.panel} id="route-planner">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>ROUTE</p>
                <h2>Choose your route</h2>
              </div>
              <button
                className={styles.collapseButton}
                type="button"
                onClick={() => setIsRouteOpen(false)}
                aria-label="Hide route planner"
                title="Hide route planner"
              >
                <CollapseIcon />
              </button>
            </div>

            <p className={styles.helperText}>
              Select two cities on the map to run automatically. Dropdown changes wait for Run search.
            </p>

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
              <p className={styles.mapHint}>
                Map: choose a starting point, then a destination.
              </p>
              <button className={styles.runButton} type="button" onClick={() => void run()} disabled={isLoading}>
                {isLoading ? "Running Rust…" : "Run search"}
              </button>
            </div>

            {error && <p className={styles.errorMessage} role="alert">{error}</p>}
          </aside>
        ) : (
          <button
            className={styles.routeLauncher}
            type="button"
            onClick={() => setIsRouteOpen(true)}
            aria-expanded="false"
            aria-controls="route-planner"
          >
            <RouteIcon />
            Route
          </button>
        )}

        {isPlaybackMinimized ? (
          <button
            className={styles.playbackMinimized}
            type="button"
            onClick={() => setIsPlaybackMinimized(false)}
            aria-label="Open playback controls"
            title="Open playback controls"
          >
            <span className={styles.departureIcon} aria-hidden="true">+</span>
            <span>Playback</span>
          </button>
        ) : (
          <div className={styles.animationControls}>
            <button
              className={styles.playbackMinimizeButton}
              type="button"
              onClick={() => setIsPlaybackMinimized(true)}
              aria-label="Minimize playback controls"
              title="Minimize playback controls"
            >
              <span className={styles.departureIcon} aria-hidden="true">−</span>
            </button>
            <span className={styles.playbackLabel}>Playback</span>
            <div className={styles.controls}>
              <button
                className={styles.controlButton}
                type="button"
                onClick={isPlaying ? pause : play}
                disabled={!data || isLoading}
                aria-label={isPlaying ? "Pause animation" : "Play animation"}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button className={styles.controlButton} type="button" onClick={replay} disabled={!data || isLoading} aria-label="Replay animation" title="Replay">
                <ReplayIcon />
              </button>
              <label className={styles.speedControl}>
                <span>Speed</span>
                <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
                  <option value={0.5}>0.5×</option>
                  <option value={1}>1×</option>
                  <option value={2}>2×</option>
                </select>
              </label>
            </div>
            <label className={styles.frameScrubber}>
              <span>Frame scroll</span>
              <output aria-live="polite">
                {timelineLength ? Math.min(step, lastStep) + 1 : 0} / {timelineLength}
              </output>
              <input
                type="range"
                min={0}
                max={lastStep}
                step={1}
                value={timelineLength ? Math.min(step, lastStep) : 0}
                disabled={!data || timelineLength <= 1 || isLoading}
                aria-label="Animation frame"
                style={{ "--frame-progress": progress + "%" } as CSSProperties}
                onChange={(event) => {
                  pause();
                  setStep(Number(event.target.value));
                }}
                onWheel={(event) => {
                  if (!data || timelineLength <= 1) return;
                  event.preventDefault();
                  pause();
                  const direction = event.deltaY > 0 ? 1 : -1;
                  setStep(Math.min(lastStep, Math.max(0, step + direction)));
                }}
              />
            </label>
          </div>
        )}
      </section>
    </main>
  );
}

function CitySearch({
  label,
  selectedCity,
  onFocus,
  onSelect,
}: {
  label: string;
  selectedCity: number;
  onFocus: () => void;
  onSelect: (cityId: number) => void;
}) {
  const listId = useId();
  const selected = romaniaGraph.cities[selectedCity];
  const [query, setQuery] = useState(selected.name);
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
    setQuery(selected.name);
  }, [selected.name]);

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
      setQuery(selected.name);
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
          window.setTimeout(() => {
            setIsOpen(false);
            setQuery(romaniaGraph.cities[selectedCity].name);
          }, 100);
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
            <button
              key={city.id}
              id={`${listId}-${city.id}`}
              type="button"
              role="option"
              aria-selected={city.id === selectedCity}
              className={index === activeIndex ? styles.activeOption : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(city.id)}
            >
              {city.name}
            </button>
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

function PlayIcon() {
  return (
    <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M3 2h3v2h3v2h3v2h3v4h-3v2H9v2H6v2H3Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M3 2h6v16H3Zm2 3v10h2V5Zm6-3h6v16h-6Zm2 3v10h2V5Z" fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

function ReplayIcon() {
  return (
    <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d="M2 3h3V1h2v2h7v2H7v2H5v2H3V7H1V3Zm12 2h2v2h2v7h-2v2h-2v2H6v-2h8v-2h2V7h-2Z" fill="currentColor" />
    </svg>
  );
}

function ZoomInIcon() {
  return (
    <svg className={styles.zoomIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg className={styles.zoomIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M4 10h12" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className={styles.smallIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 10h10" />
    </svg>
  );
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

function LegendIcon() {
  return (
    <svg className={styles.smallIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m3 5 4-2 6 2 4-2v12l-4 2-6-2-4 2Z" />
      <path d="M7 3v12M13 5v12" />
    </svg>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return <div className={styles.legendRow}><span className={className} />{label}</div>;
}

type CityPosition = (typeof romaniaGraph.cities)[number];

function roadLabelPosition(start: CityPosition, end: CityPosition) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const offset = 13;
  return {
    x: (start.x + end.x) / 2 - (deltaY / length) * offset,
    y: (start.y + end.y) / 2 + (deltaX / length) * offset,
  };
}

function SearchTreeLines({ discovered, cityById, className, offset }: { discovered: DiscoveredNode[]; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  return (
    <g className={styles.searchTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} cityById={cityById} className={className} offset={offset} />
      ))}
    </g>
  );
}

function ExpandedTreeLines({ discovered, expanded, cityById, className, offset }: { discovered: DiscoveredNode[]; expanded: Set<number>; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  return (
    <g className={styles.expandedTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null || !expanded.has(node.city) ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} cityById={cityById} className={className} offset={offset} />
      ))}
    </g>
  );
}

function PathLines({ path, cityById, className, offset }: { path: number[]; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  return (
    <g className={styles.finalPath} aria-hidden="true">
      {path.slice(0, -1).map((city, index) => (
        <GraphLine key={`${city}-${path[index + 1]}`} from={city} to={path[index + 1]} cityById={cityById} className={className} offset={offset} />
      ))}
    </g>
  );
}

function GraphLine({ from, to, cityById, className, offset }: { from: number; to: number; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  const start = cityById.get(from);
  const end = cityById.get(to);
  if (!start || !end) return null;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const shiftX = (-(end.y - start.y) / length) * offset;
  const shiftY = ((end.x - start.x) / length) * offset;
  return <line className={className} x1={start.x + shiftX} y1={start.y + shiftY} x2={end.x + shiftX} y2={end.y + shiftY} />;
}
