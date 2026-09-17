// components/search/SearchMap.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { countyOutlines } from "../../lib/countyOutlines";
import { mercatorCityPositions, PROJECTION, unprojectToLatLng } from "../../lib/mercatorProjection";
import { neighboringCountries, seaAreas } from "../../lib/neighboringContext";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { getRoadPathD, polylineMidpoint, getRoadPoints } from "../../lib/roadPath";
import type { RoadVariant } from "../../lib/roadPath";
import { getRouteCountyDots } from "../../lib/routeCountyDots";
import type { RouteDotDensity } from "../../lib/routeCountyDots";
import {
  getExpandedCities,
  getExpandedPathPrefix,
  getFinalPath,
  getFrontierCities,
  getTraceFrame,
} from "../../lib/traceSelectors";
import type { DiscoveredNode } from "../../lib/types";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./SearchMap.module.css";

import { APIProvider, Map as GoogleMap } from "@vis.gl/react-google-maps";

const GOOGLE_MAP_CENTER = { lat: 45.9432, lng: 24.9668 };

// Our own SVG overlay already draws every label we want (Romanian cities, plus
// neighboring-country context in neighboringContext.ts). The plain "satellite"
// map type has no place-name layer at all, so it never clutters -- match that
// on terrain by turning off all of Google's own labels, everywhere.
//
// The country border stroke is turned off too, not just its label: Google
// renders it in true Web Mercator, while our SVG border (countyOutlines.ts) is
// a deliberately undistorted linear-equirectangular schematic. The two
// projections agree on longitude but diverge on latitude scaling further from
// the view's center, so Google's line visibly drifts from ours near the map
// edges -- see docs/rootcause/terrain-border-mercator-mismatch.json. That's
// structural (fixable only by re-projecting all SVG geometry, or moving to a
// projection-controllable renderer like MapLibre), so instead of showing two
// disagreeing borders, only our own is shown.
const TERRAIN_MAP_STYLES = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
  // Neighboring countries' own internal divisions (e.g. Hungarian megye,
  // Ukrainian oblast borders) render as dashed lines -- unrelated real-world
  // context, no different in kind from the country border above.
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
];

function GoogleBackgroundMap({
  mapType,
  center,
  zoom,
}: {
  mapType: "terrain" | "satellite";
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMap
        center={center}
        zoom={zoom}
        mapTypeId={mapType}
        styles={mapType === "terrain" ? TERRAIN_MAP_STYLES : undefined}
        disableDefaultUI
        gestureHandling="none"
        keyboardShortcuts={false}
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      />
    </APIProvider>
  );
}

// Padded out from Romania's own tight bounds (120,50,900,650) so neighboring
// countries and the Black Sea have room to render as visual-only context.
// This is a *reference* shape, not the final one: getEffectiveMapExtent below
// stretches whichever dimension is needed so it always matches the panel's
// own rendered aspect ratio -- see the comment there for why.
const BASE_MAP_EXTENT = { x: -60, y: -60, width: 1200, height: 870 } as const;
type MapExtent = { x: number; y: number; width: number; height: number };

// The SVG's viewBox is a fixed shape (BASE_MAP_EXTENT's aspect ratio, ~1.38),
// but the panel it renders into is whatever shape the browser window makes it
// -- often much wider. With preserveAspectRatio="meet" that mismatch always
// left empty bars on one axis (the entire viewBox is shown, just not filling
// the panel), and "slice" (fill by cropping) was tried and rejected because
// it crops real map content. The only way to have neither bars nor cropping
// is for the viewBox itself to already match the panel's shape: widen (or
// heighten) BASE_MAP_EXTENT, centered on the same point, so its aspect ratio
// equals the panel's. Falls back to the unmodified reference shape until the
// panel has actually been measured (and in tests, where ResizeObserver does
// not exist) -- a brief/absent "meet" gap on first paint beats a layout that
// depends on a browser API jsdom doesn't implement.
// The neighboring-country/sea backdrop (lib/neighboringContext.ts) is pre-generated
// for a fixed geographic window (see CLIP_BOUNDS in scripts/fetch_neighboring_context.mjs)
// -- it isn't fetched live, so stretching the extent further than that window
// covers would reveal genuinely blank territory (flat backdrop grey, no real
// border data) rather than more real map. These caps match that window (with
// a safety margin) so the stretch below never asks for more than we have.
const MAP_MAX_ASPECT = 2.35;
const MAP_MIN_ASPECT = 0.8;

function getEffectiveMapExtent(containerAspect: number | null): MapExtent {
  if (!containerAspect || !Number.isFinite(containerAspect)) return BASE_MAP_EXTENT;

  const clampedAspect = Math.min(MAP_MAX_ASPECT, Math.max(MAP_MIN_ASPECT, containerAspect));
  const baseAspect = BASE_MAP_EXTENT.width / BASE_MAP_EXTENT.height;
  const centerX = BASE_MAP_EXTENT.x + BASE_MAP_EXTENT.width / 2;
  const centerY = BASE_MAP_EXTENT.y + BASE_MAP_EXTENT.height / 2;

  if (clampedAspect > baseAspect) {
    const width = BASE_MAP_EXTENT.height * clampedAspect;
    return { x: centerX - width / 2, y: BASE_MAP_EXTENT.y, width, height: BASE_MAP_EXTENT.height };
  }
  const height = BASE_MAP_EXTENT.width / clampedAspect;
  return { x: BASE_MAP_EXTENT.x, y: centerY - height / 2, width: BASE_MAP_EXTENT.width, height };
}

const MAP_MIN_ZOOM = 1;
const MAP_MAX_ZOOM = 2;
const MAP_ZOOM_STEP = 0.25;
const TRACKPAD_SCROLL_ZOOM_SENSITIVITY = 0.0025;
const TRACKPAD_PINCH_ZOOM_SENSITIVITY = 0.01;
const MAX_WHEEL_ZOOM_EXPONENT = 0.35;

type MapTouchPoint = { x: number; y: number };
type MapViewport = { zoom: number; centerX: number; centerY: number };
type MapDisplayMode = "default" | "terrain" | "satellite";
type PinchGesture = { startDistance: number; startViewport: MapViewport };
type PanGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: MapViewport;
  unitsPerPixel: number;
  moved: boolean;
};

// BASE_MAP_EXTENT's center, not the (possibly stretched) effective extent's --
// getEffectiveMapExtent always stretches symmetrically around the same center
// point, so the two are always equal and this stays a plain constant.
const INITIAL_MAP_VIEWPORT: MapViewport = {
  zoom: MAP_MIN_ZOOM,
  centerX: BASE_MAP_EXTENT.x + BASE_MAP_EXTENT.width / 2,
  centerY: BASE_MAP_EXTENT.y + BASE_MAP_EXTENT.height / 2,
};

const mapDisplayModes: { value: MapDisplayMode; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "terrain", label: "Terrain" },
  { value: "satellite", label: "Satellite" },
];

const mapDisplayModeClass: Record<MapDisplayMode, string> = {
  default: styles.displayDefault,
  terrain: styles.displayTerrain,
  satellite: styles.displaySatellite,
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

function clampMapViewport(viewport: MapViewport, extent: MapExtent): MapViewport {
  const zoom = clampMapZoom(viewport.zoom);
  const width = extent.width / zoom;
  const height = extent.height / zoom;
  const minCenterX = extent.x + width / 2;
  const maxCenterX = extent.x + extent.width - width / 2;
  const minCenterY = extent.y + height / 2;
  const maxCenterY = extent.y + extent.height - height / 2;

  return {
    zoom,
    centerX: Math.min(maxCenterX, Math.max(minCenterX, viewport.centerX)),
    centerY: Math.min(maxCenterY, Math.max(minCenterY, viewport.centerY)),
  };
}

function getMapViewBox(viewport: MapViewport, extent: MapExtent) {
  const width = extent.width / viewport.zoom;
  const height = extent.height / viewport.zoom;
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
  const [displayMode, setDisplayMode] = useState<MapDisplayMode>("default");
  // Roads/cities are drawn from a parallel Mercator-projected coordinate set
  // whenever a Google background is visible, so they line up with Google's
  // own (Mercator) rendering instead of our undistorted equirectangular
  // schematic -- see lib/mercatorProjection.ts. County outlines stay
  // equirectangular always; see docs/rootcause/terrain-border-mercator-mismatch.json.
  const roadVariant: RoadVariant = displayMode === "default" ? "default" : "mercator";
  // Null until the panel has actually been measured (and permanently null in
  // tests, where jsdom has no ResizeObserver) -- getEffectiveMapExtent treats
  // that as "use the fixed reference shape, unmodified".
  const [containerAspect, setContainerAspect] = useState<number | null>(null);
  // Separate from containerAspect: the Google Maps zoom-level calculation below
  // needs the actual rendered pixel width, not just the aspect ratio.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const mapExtent = useMemo(() => getEffectiveMapExtent(containerAspect), [containerAspect]);
  const [displayModesExpanded, setDisplayModesExpanded] = useState(false);
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
      }, mapExtent));
    };

    map.addEventListener("wheel", handleTrackpadZoom, { passive: false });
    return () => map.removeEventListener("wheel", handleTrackpadZoom);
  }, [mapExtent]);

  // Keeps the SVG's own viewBox always matching the panel's actual rendered
  // shape, so preserveAspectRatio="meet" never has empty space left over on
  // either axis and nothing needs to crop -- see getEffectiveMapExtent above.
  // Absent in tests (jsdom has no ResizeObserver): containerAspect just stays
  // null there, which getEffectiveMapExtent already treats as "unmodified".
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width <= 0 || height <= 0) return;
      setContainerAspect(width / height);
      setContainerWidth(width);
    });
    observer.observe(map);
    return () => observer.disconnect();
  }, []);

  // The panel can resize (window resize, sidebar toggle) while zoomed or panned
  // away from center -- re-clamp so the viewport never ends up outside the
  // extent that resize just changed.
  useEffect(() => {
    setMapViewport((viewport) => clampMapViewport(viewport, mapExtent));
  }, [mapExtent]);

  // Only a real reset() sets BOTH cities to null at once -- the rolling-restart on a
  // third click clears destinationCity but sets startCity to the newly clicked city,
  // so this never fires there. That's deliberate: the Reset button snaps the map back,
  // a mid-route restart leaves the viewport where the user left it.
  useEffect(() => {
    if (startCity === null && destinationCity === null) {
      setMapViewport(INITIAL_MAP_VIEWPORT);
    }
  }, [startCity, destinationCity]);

  const ucsFrame = getTraceFrame(data, "ucs", step);
  const astarFrame = getTraceFrame(data, "astar", step);
  const ucsExpanded = getExpandedCities(data, "ucs", step);
  const astarExpanded = getExpandedCities(data, "astar", step);
  const astarDotPath = data ? getExpandedPathPrefix(data.astar.path, astarExpanded) : [];
  const ucsFrontier = getFrontierCities(ucsFrame);
  const astarFrontier = getFrontierCities(astarFrame);
  const ucsComplete = Boolean(data && step >= data.ucs.trace.length - 1);
  const astarComplete = Boolean(data && step >= data.astar.trace.length - 1);
  const finalPath = getFinalPath(data, ucsComplete, astarComplete);
  const mapZoom = mapViewport.zoom;

  // Keeps the Google Maps background (Terrain/Satellite modes) in sync with the
  // schematic overlay's own pan/zoom -- otherwise the SVG zooms in on Romania
  // while the imagery underneath just sits at its fixed initial view. Zoom is
  // derived by matching how many degrees of longitude the current viewBox
  // spans against how many degrees a Google Maps zoom level spans at the
  // panel's actual pixel width (Google: 360deg over 256*2^zoom px).
  // Standard (non-vector) map tiles only render at integer zoom levels, but
  // MAP_MIN_ZOOM..MAP_MAX_ZOOM only spans a single doubling (one whole Google
  // zoom level) in total -- rounding to the nearest integer would make nearly
  // every zoom step land on the same tile zoom, with the one real crossing
  // landing wherever the container width happens to put it (often right at
  // the end, which read as "only the last zoom step does anything"). Instead,
  // tiles are always fetched at the floor -- never sharper than needed, so
  // `scale` below is always >= 1 and the wrapper never shrinks smaller than
  // the panel and reveals blank edges -- and `scale` CSS-zooms those tiles
  // continuously in between, so every step visibly moves the background,
  // snapping back to a freshly-loaded 1x whenever floor(rawZoom) increments.
  const googleView = useMemo(() => {
    const center = unprojectToLatLng(mapViewport.centerX, mapViewport.centerY);
    if (!containerWidth) return { center: GOOGLE_MAP_CENTER, zoom: 7, scale: 1 };
    const viewWidthSvgUnits = mapExtent.width / mapViewport.zoom;
    const lonSpanDegrees = viewWidthSvgUnits / PROJECTION.lonScale;
    const rawZoom = Math.log2((360 * containerWidth) / (256 * lonSpanDegrees));
    const zoom = Math.floor(rawZoom);
    const scale = 2 ** (rawZoom - zoom);
    return { center, zoom, scale };
  }, [mapViewport, mapExtent, containerWidth]);

  // Deliberately does NOT setPointerCapture here. Capturing at pointerdown -- before
  // we know whether the gesture is a click or a drag -- redirects the click event
  // that follows a plain tap/click to the capturing element instead of the city <g>
  // actually under the pointer, so the city's own onClick never fires. Capture is
  // acquired only once handleMapPointerMove confirms real movement (see there). See
  // docs/rootcause/search-map-zoom-blocks-city-clicks.json.
  const beginMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewWidth = mapExtent.width / mapZoom;
    const viewHeight = mapExtent.height / mapZoom;
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
  };

  const handleMapPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") {
      mapTouchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (mapTouchesRef.current.size === 2) {
        const startDistance = getTouchDistance(Array.from(mapTouchesRef.current.values()));
        if (startDistance > 0) {
          pinchGestureRef.current = { startDistance, startViewport: mapViewport };
          panGestureRef.current = null;
          setIsMapPanning(false);
          suppressMapClickUntilRef.current = Date.now() + 500;
          // A confirmed second touch is unambiguously a pinch, never a tap -- capture
          // both touches immediately so neither loses tracking if a finger slides
          // outside the SVG mid-gesture.
          for (const pointerId of mapTouchesRef.current.keys()) {
            event.currentTarget.setPointerCapture?.(pointerId);
          }
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
      }, mapExtent));
      suppressMapClickUntilRef.current = Date.now() + 500;
      event.preventDefault();
      return;
    }

    const panGesture = panGestureRef.current;
    if (!panGesture || panGesture.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - panGesture.startX;
    const deltaY = event.clientY - panGesture.startY;
    if (!panGesture.moved && Math.hypot(deltaX, deltaY) <= 4) return;

    if (!panGesture.moved) {
      // First move past the threshold: this is now confirmed a drag, not a click --
      // capture the pointer here, and only here.
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    panGesture.moved = true;
    setIsMapPanning(true);
    setMapViewport(clampMapViewport({
      zoom: panGesture.startViewport.zoom,
      centerX: panGesture.startViewport.centerX - deltaX * panGesture.unitsPerPixel,
      centerY: panGesture.startViewport.centerY - deltaY * panGesture.unitsPerPixel,
    }, mapExtent));
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
    }, mapExtent));
  };

  const mapClassName = [
    styles.map,
    mapZoom > MAP_MIN_ZOOM ? styles.mapPannable : "",
    isMapPanning ? styles.mapPanning : "",
  ].filter(Boolean).join(" ");
  const mapPanelClassName = [styles.mapPanel, mapDisplayModeClass[displayMode]].join(" ");

  return (
    <div className={mapPanelClassName}>
      {displayMode !== "default" && (
        <div
          className={styles.mapBackgroundImage}
          style={{ transform: `scale(${googleView.scale})`, transformOrigin: "center center" }}
        >
          <GoogleBackgroundMap
            mapType={displayMode === "satellite" ? "satellite" : "terrain"}
            center={googleView.center}
            zoom={googleView.zoom}
          />
        </div>
      )}
      <svg
        ref={mapRef}
        className={mapClassName}
        viewBox={getMapViewBox(mapViewport, mapExtent)}
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
          {countyOutlines.map((path, index) => (
            <clipPath id={"route-county-" + index} key={index}>
              <path d={path} />
            </clipPath>
          ))}
          {/* Countries clipped to this small viewport show a hard straight cut wherever
              their real border falls outside it -- Hungary's is the most visible since
              its own territory reaches furthest past our frame. Fading every shape out
              near the frame's edge (radially, from the map's own center) turns every
              such cut into a soft vignette instead, and also blends the "meet"
              letterbox strip into the same fade rather than a sharp color edge. */}
          {/* An ellipse inscribed (with a little overhang) in the extent's own
              rectangle, via gradientTransform, rather than a fixed circle --
              extent is now a dynamic shape (see getEffectiveMapExtent), so a
              hardcoded center/radius would vignette a wide panel off-center
              and cut a narrow one short. */}
          <radialGradient
            id="neighboring-fade-gradient"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="1"
            gradientTransform={`translate(${mapExtent.x + mapExtent.width / 2} ${mapExtent.y + mapExtent.height / 2}) scale(${mapExtent.width * 0.58} ${mapExtent.height * 0.58})`}
          >
            <stop offset="55%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="neighboring-fade" maskUnits="userSpaceOnUse" x={mapExtent.x} y={mapExtent.y} width={mapExtent.width} height={mapExtent.height}>
            <rect x={mapExtent.x} y={mapExtent.y} width={mapExtent.width} height={mapExtent.height} fill="url(#neighboring-fade-gradient)" />
          </mask>
          {/* Terrain/Satellite has no separate neighboring-country shapes to fade
              (it's one continuous Google image) -- same ellipse as the fade above,
              inverted: transparent over Romania, opaque toward the edges, painted
              as an overlay directly on top of the Google background instead of a
              mask on top of vector shapes. */}
          <radialGradient
            id="terrain-vignette-gradient"
            gradientUnits="userSpaceOnUse"
            cx="0"
            cy="0"
            r="1"
            gradientTransform={`translate(${mapExtent.x + mapExtent.width / 2} ${mapExtent.y + mapExtent.height / 2}) scale(${mapExtent.width * 0.58} ${mapExtent.height * 0.58})`}
          >
            <stop offset="45%" stopColor="var(--neighbor-fill)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--neighbor-fill)" stopOpacity="0.92" />
          </radialGradient>
        </defs>

        {displayMode !== "default" && (
          <rect
            className={styles.terrainVignette}
            aria-hidden="true"
            x={mapExtent.x}
            y={mapExtent.y}
            width={mapExtent.width}
            height={mapExtent.height}
            fill="url(#terrain-vignette-gradient)"
          />
        )}

        {displayMode === "default" && (
          <g className={styles.neighboringContext} aria-hidden="true">
            {/* Unmasked and always fully opaque -- the far corners (behind the Route
                and Map key panels) must stay filled grey, never fade toward the panel
                background the way the shapes below are allowed to. */}
            <rect
              className={styles.neighborBackdrop}
              x={mapExtent.x}
              y={mapExtent.y}
              width={mapExtent.width}
              height={mapExtent.height}
            />
          <g mask="url(#neighboring-fade)">
            {seaAreas.map((path, index) => <path key={index} className={styles.seaArea} d={path} />)}
            {neighboringCountries.map((country) =>
              country.paths.map((path, index) => (
                <path key={`${country.name}-${index}`} className={styles.neighborCountry} d={path} />
              )),
            )}
          </g>
            {/* Labels stay outside the fade -- they're already positioned deep inside
                each shape (see visualCenter in the generator script), and legibility
                matters more here than matching the vignette. */}
            {neighboringCountries
              .filter((country) => country.label !== null)
              .map((country) => (
                <text key={country.name} className={styles.neighborLabel} x={country.label!.x} y={country.label!.y}>
                  {country.name === "Republic of Serbia" ? "Serbia" : country.name}
                </text>
              ))}
          </g>
        )}

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
                <path className={styles.roadCasing} d={getRoadPathD(from, to, 0, roadVariant)} />
                <path className={styles.roadCenter} d={getRoadPathD(from, to, 0, roadVariant)} />
              </g>
            );
          })}
        </g>

        {ucsFrame && <SearchTreeLines discovered={ucsFrame.discovered} className={styles.ucsTree} offset={-2} variant={roadVariant} />}
        {astarFrame && <SearchTreeLines discovered={astarFrame.discovered} className={styles.astarTree} offset={2} variant={roadVariant} />}
        {ucsFrame && <ExpandedTreeLines discovered={ucsFrame.discovered} expanded={ucsExpanded} className={styles.ucsPath} offset={-3} variant={roadVariant} />}
        {astarFrame && <ExpandedTreeLines discovered={astarFrame.discovered} expanded={astarExpanded} className={styles.astarPath} offset={3} variant={roadVariant} />}
        {astarDotPath.length > 1 && <PathDots path={astarDotPath} className={styles.astarRouteDots} offset={3} />}
        {ucsComplete && data && <PathLines path={data.ucs.path} className={styles.ucsPath} offset={-3} variant={roadVariant} />}
        {astarComplete && data && <PathLines path={data.astar.path} className={styles.astarPath} offset={3} variant={roadVariant} />}

        <g className={styles.roadLabels} aria-hidden="true">
          {romaniaGraph.roads.map(([from, to, distance]) => {
            const position = roadLabelPosition(from, to, roadVariant);
            return <text key={`${from}-${to}`} x={position.x} y={position.y}>{distance}</text>;
          })}
        </g>

        {romaniaGraph.cities.map((city) => {
          const position = displayMode === "default" ? city : (mercatorCityPositions.get(city.id) ?? city);
          const offset = labelOffsets[city.id] ?? { x: 0, y: 22 };
          const labelX = position.x + offset.x;
          const labelY = position.y + offset.y;
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
            setCity(selecting, city.id);
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
              <rect className={styles.cityNode} x={position.x - 5} y={position.y - 5} width="10" height="10" rx="2" />
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

      <div className={styles.displayModeControls} role="group" aria-label="Map display mode">
        {mapDisplayModes.filter((mode) => displayModesExpanded || mode.value === displayMode).map((mode) => (
          <button
            key={mode.value}
            className={[
              styles.displayModeButton,
              displayMode === mode.value ? styles.displayModeButtonActive : "",
            ].filter(Boolean).join(" ")}
            type="button"
            aria-pressed={displayMode === mode.value}
            aria-label={`Use ${mode.label.toLowerCase()} map display`}
            title={`${mode.label} map display`}
            onClick={() => setDisplayMode(mode.value)}
          >
            {mode.label}
          </button>
        ))}
        <button
          className={styles.displayModeToggle}
          type="button"
          aria-expanded={displayModesExpanded}
          aria-label={displayModesExpanded ? "Hide map display options" : "Show map display options"}
          title={displayModesExpanded ? "Hide map display options" : "Show map display options"}
          onClick={() => setDisplayModesExpanded((expanded) => !expanded)}
        >
          {displayModesExpanded ? "<" : ">"}
        </button>
      </div>

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

function roadLabelPosition(from: number, to: number, variant: RoadVariant = "default") {
  const mid = polylineMidpoint(getRoadPoints(from, to, variant));
  const offset = 13;
  const round = (value: number) => Number(value.toFixed(2));
  return {
    x: round(mid.x + mid.nx * offset),
    y: round(mid.y + mid.ny * offset),
  };
}

function SearchTreeLines({ discovered, className, offset, variant }: { discovered: DiscoveredNode[]; className: string; offset: number; variant: RoadVariant }) {
  return (
    <g className={styles.searchTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} className={className} offset={offset} variant={variant} />
      ))}
    </g>
  );
}

function ExpandedTreeLines({ discovered, expanded, className, offset, variant }: { discovered: DiscoveredNode[]; expanded: Set<number>; className: string; offset: number; variant: RoadVariant }) {
  return (
    <g className={styles.expandedTree} aria-hidden="true">
      {discovered.map((node) => node.parent === null || !expanded.has(node.city) ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} className={className} offset={offset} variant={variant} />
      ))}
    </g>
  );
}

const routeDotDensityClass: Record<RouteDotDensity, string> = {
  near: styles.routeDotsNear,
  mid: styles.routeDotsMid,
  far: styles.routeDotsFar,
};

function PathDots({ path, className, offset }: { path: number[]; className: string; offset: number }) {
  const counties = useMemo(() => getRouteCountyDots(path, offset), [path, offset]);
  return (
    <g className={[styles.routeDots, className].join(" ")} aria-hidden="true">
      {counties.map((county) => (
        <g
          key={county.countyIndex}
          data-route-county={county.countyIndex}
          clipPath={"url(#route-county-" + county.countyIndex + ")"}
        >
          {county.dots.map((dot) => (
            <circle
              key={`${dot.x}-${dot.y}`}
              className={routeDotDensityClass[dot.density]}
              cx={dot.x}
              cy={dot.y}
              r="1.8"
              style={{
                "--route-dot-delay": `${Math.abs(Math.round(dot.x * 3 + dot.y * 5)) % 10 * 12}ms`,
              } as CSSProperties}
            />
          ))}
        </g>
      ))}
    </g>
  );
}

function PathLines({ path, className, offset, variant }: { path: number[]; className: string; offset: number; variant: RoadVariant }) {
  return (
    <g className={styles.finalPath} aria-hidden="true">
      {path.slice(0, -1).map((city, index) => (
        <GraphLine key={`${city}-${path[index + 1]}`} from={city} to={path[index + 1]} className={className} offset={offset} variant={variant} />
      ))}
    </g>
  );
}

function GraphLine({ from, to, className, offset, variant }: { from: number; to: number; className: string; offset: number; variant: RoadVariant }) {
  return <path className={className} d={getRoadPathD(from, to, offset, variant)} />;
}
