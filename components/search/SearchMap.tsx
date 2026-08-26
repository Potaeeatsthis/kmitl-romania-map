"use client";

import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { countyOutlines } from "../../lib/countyOutlines";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { getRoadPathD, polylineMidpoint, getRoadPoints } from "../../lib/roadPath";
import {
  getExpandedCities,
  getFinalPath,
  getFrontierCities,
  getTraceFrame,
} from "../../lib/traceSelectors";
import type { DiscoveredNode } from "../../lib/types";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./SearchMap.module.css";

const MAP_VIEW_BOX = { x: 120, y: 50, width: 900, height: 650 } as const;
const MAP_MIN_ZOOM = 1;
const MAP_MAX_ZOOM = 2;
const MAP_ZOOM_STEP = 0.25;
const TRACKPAD_SCROLL_ZOOM_SENSITIVITY = 0.0025;
const TRACKPAD_PINCH_ZOOM_SENSITIVITY = 0.01;
const MAX_WHEEL_ZOOM_EXPONENT = 0.35;

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

const labelOffsets: Record<number, { x: number; y: number }> = {
  0: { x: -21, y: -5 }, 1: { x: -20, y: -10 }, 2: { x: -3, y: -22 },
  3: { x: 7, y: -21 }, 4: { x: -22, y: 16 }, 5: { x: 13, y: -18 },
  6: { x: -34, y: 4 }, 7: { x: -14, y: 19 }, 8: { x: 3, y: 24 },
  9: { x: 30, y: -21 }, 10: { x: 12, y: -20 }, 11: { x: 11, y: -21 },
  12: { x: 34, y: 20 }, 13: { x: -4, y: 23 }, 14: { x: -20, y: -15 },
  15: { x: 11, y: -21 }, 16: { x: 13, y: 17 }, 17: { x: 32, y: -10 },
  18: { x: 12, y: -18 }, 19: { x: -32, y: 0 },
};

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

export default function SearchMap() {
  const [mapViewport, setMapViewport] = useState<MapViewport>(INITIAL_MAP_VIEWPORT);
  const [isMapPanning, setIsMapPanning] = useState(false);
  const mapRef = useRef<SVGSVGElement>(null);
  const mapTouchesRef = useRef(new Map<number, MapTouchPoint>());
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const suppressMapClickUntilRef = useRef(0);

  const data = useSearchStore((state) => state.data);
  const step = useSearchStore((state) => state.step);
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const selecting = useSearchStore((state) => state.selecting);
  const setCity = useSearchStore((state) => state.setCity);

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
  const finalPath = getFinalPath(data, ucsComplete, astarComplete);
  const mapZoom = mapViewport.zoom;

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
      if (mapTouchesRef.current.size < 2) pinchGestureRef.current = null;
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

  const mapClassName = [
    styles.map,
    mapZoom > MAP_MIN_ZOOM ? styles.mapPannable : "",
    isMapPanning ? styles.mapPanning : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={styles.mapPanel}>
      <svg
        ref={mapRef}
        className={mapClassName}
        viewBox={getMapViewBox(mapViewport)}
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
          {countyOutlines.map((path, index) => <path key={index} d={path} />)}
        </g>
        <g className={styles.countyLines} aria-hidden="true">
          {countyOutlines.map((path, index) => <path key={index} d={path} />)}
        </g>

        <g className={styles.roads} aria-hidden="true">
          {romaniaGraph.roads.map(([from, to]) => {
            return (
              <g key={`${from}-${to}`}>
                <path className={styles.roadCasing} d={getRoadPathD(from, to, 0)} />
                <path className={styles.roadCenter} d={getRoadPathD(from, to, 0)} />
              </g>
            );
          })}
        </g>

        {ucsFrame && <SearchTreeLines discovered={ucsFrame.discovered} className={styles.ucsTree} offset={-2} />}
        {astarFrame && <SearchTreeLines discovered={astarFrame.discovered} className={styles.astarTree} offset={2} />}
        {ucsFrame && <ExpandedTreeLines discovered={ucsFrame.discovered} expanded={ucsExpanded} className={styles.ucsPath} offset={-3} />}
        {astarFrame && <ExpandedTreeLines discovered={astarFrame.discovered} expanded={astarExpanded} className={styles.astarPath} offset={3} />}
        {ucsComplete && data && <PathLines path={data.ucs.path} className={styles.ucsPath} offset={-3} />}
        {astarComplete && data && <PathLines path={data.astar.path} className={styles.astarPath} offset={3} />}

        <g className={styles.roadLabels} aria-hidden="true">
          {romaniaGraph.roads.map(([from, to, distance]) => {
            const position = roadLabelPosition(from, to);
            return <text key={`${from}-${to}`} x={position.x} y={position.y}>{distance}</text>;
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
            if (selectedField === "destination") void useSearchStore.getState().run();
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
              <text className={labelHighlightClass ? styles.highlightedCityLabel : undefined} x={labelX} y={labelY}>
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

      <div className={styles.zoomControls} role="group" aria-label={`Map zoom controls, ${Math.round(mapZoom * 100)}%`}>
        <button className={styles.zoomButton} type="button" onClick={() => updateMapZoom(MAP_ZOOM_STEP)} disabled={mapZoom >= MAP_MAX_ZOOM - 0.001} aria-label="Zoom in" title="Zoom in">
          <ZoomInIcon />
        </button>
        <button className={styles.zoomButton} type="button" onClick={() => updateMapZoom(-MAP_ZOOM_STEP)} disabled={mapZoom <= MAP_MIN_ZOOM + 0.001} aria-label="Zoom out" title="Zoom out">
          <ZoomOutIcon />
        </button>
      </div>
    </div>
  );
}

function ZoomInIcon() {
  return <svg className={styles.zoomIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 4v12M4 10h12" /></svg>;
}

function ZoomOutIcon() {
  return <svg className={styles.zoomIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h12" /></svg>;
}

function roadLabelPosition(from: number, to: number) {
  const mid = polylineMidpoint(getRoadPoints(from, to));
  const offset = 13;
  return {
    x: mid.x + mid.nx * offset,
    y: mid.y + mid.ny * offset,
  };
}

function SearchTreeLines({ discovered, className, offset }: { discovered: DiscoveredNode[]; className: string; offset: number }) {
  return (
    <g className={styles.searchTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} className={className} offset={offset} />
      ))}
    </g>
  );
}

function ExpandedTreeLines({ discovered, expanded, className, offset }: { discovered: DiscoveredNode[]; expanded: Set<number>; className: string; offset: number }) {
  return (
    <g className={styles.expandedTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null || !expanded.has(node.city) ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} className={className} offset={offset} />
      ))}
    </g>
  );
}

function PathLines({ path, className, offset }: { path: number[]; className: string; offset: number }) {
  return (
    <g className={styles.finalPath} aria-hidden="true">
      {path.slice(0, -1).map((city, index) => (
        <GraphLine key={`${city}-${path[index + 1]}`} from={city} to={path[index + 1]} className={className} offset={offset} />
      ))}
    </g>
  );
}

function GraphLine({ from, to, className, offset }: { from: number; to: number; className: string; offset: number }) {
  return <path className={className} d={getRoadPathD(from, to, offset)} />;
}
