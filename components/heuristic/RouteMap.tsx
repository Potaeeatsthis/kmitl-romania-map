// components/heuristic/RouteMap.tsx
"use client";

import { countyOutlines } from "../../lib/countyOutlines";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { getRoadPathD } from "../../lib/roadPath";
import styles from "./RouteMap.module.css";

export type MarkerRole = "focus" | "chosen" | "considered" | "path" | "goal";

export type RouteMapMarker = {
  cityId: number;
  role: MarkerRole;
  note?: string;
};

function hasDirectRoad(a: number, b: number): boolean {
  return romaniaGraph.roads.some(
    ([from, to]) => (from === a && to === b) || (from === b && to === a),
  );
}

/**
 * Bounding viewBox around a set of cities, padded and then expanded on
 * the shorter axis so the box matches targetAspect. Without this, a
 * diagonal route (e.g. Arad -> Bucharest) gets a tight box whose aspect
 * ratio doesn't match the SVG frame, and preserveAspectRatio="xMidYMid meet"
 * letterboxes it -- leaving big empty triangles in two corners. Growing the
 * shorter axis around the same center keeps every city in frame while
 * filling the panel edge-to-edge.
 */
export function computeViewBox(
  cityIds: number[],
  padding = 90,
  targetAspect = 16 / 10,
): string {
  const cities = cityIds
    .map((id) => romaniaGraph.cities[id])
    .filter((city): city is (typeof romaniaGraph.cities)[number] => Boolean(city));
  if (cities.length === 0) return "120 50 900 650";

  let minX = Math.min(...cities.map((c) => c.x)) - padding;
  let maxX = Math.max(...cities.map((c) => c.x)) + padding;
  let minY = Math.min(...cities.map((c) => c.y)) - padding;
  let maxY = Math.max(...cities.map((c) => c.y)) + padding;

  let width = Math.max(maxX - minX, 160);
  let height = Math.max(maxY - minY, 160);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const currentAspect = width / height;
  if (currentAspect > targetAspect) {
    // Box is wider than the target ratio -- grow height to fill it.
    height = width / targetAspect;
  } else {
    // Box is taller than the target ratio -- grow width to fill it.
    width = height * targetAspect;
  }

  minX = centerX - width / 2;
  minY = centerY - height / 2;

  return `${minX.toFixed(1)} ${minY.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}`;
}

const FULL_VIEW_BOX = "120 50 900 650";

// Larger ring for the node the algorithm is currently standing at, smaller
// for everything else -- matches the emphasis used in SearchMap's active city.
const NODE_SIZE: Record<MarkerRole, number> = {
  focus: 15,
  chosen: 12,
  considered: 11,
  path: 9,
  goal: 15,
};

export default function RouteMap({
  viewBox = FULL_VIEW_BOX,
  pathCityIds = [],
  markers = [],
}: {
  viewBox?: string;
  /** Consecutive cities on the real, final path -- drawn as a thick highlighted route. */
  pathCityIds?: number[];
  markers?: RouteMapMarker[];
}) {
  const focusMarker = markers.find((m) => m.role === "focus");
  const chosenMarker = markers.find((m) => m.role === "chosen");
  const showFocusToChosenEdge =
    focusMarker && chosenMarker && hasDirectRoad(focusMarker.cityId, chosenMarker.cityId);

  return (
    <svg
      viewBox={viewBox}
      className={styles.svg}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Romania road map"
    >
      <g className={styles.countyLines} aria-hidden="true">
        {countyOutlines.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
      <g className={styles.countryOutline} aria-hidden="true">
        {countyOutlines.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>

      <g className={styles.roads} aria-hidden="true">
        {romaniaGraph.roads.map(([from, to]) => (
          <g key={`${from}-${to}`}>
            <path className={styles.roadCasing} d={getRoadPathD(from, to, 0)} />
            <path className={styles.roadCenter} d={getRoadPathD(from, to, 0)} />
          </g>
        ))}
      </g>

      {pathCityIds.length > 1 && (
        <g className={styles.pathRoads} aria-hidden="true">
          {pathCityIds.slice(0, -1).map((cityId, index) => (
            <path
              key={`${cityId}-${pathCityIds[index + 1]}`}
              className={styles.roadPath}
              d={getRoadPathD(cityId, pathCityIds[index + 1], 0)}
            />
          ))}
        </g>
      )}

      {showFocusToChosenEdge && focusMarker && chosenMarker && (
        <path
          className={styles.roadChosen}
          d={getRoadPathD(focusMarker.cityId, chosenMarker.cityId, 0)}
        />
      )}

      {markers.map((marker) => {
        const city = romaniaGraph.cities[marker.cityId];
        if (!city) return null;
        const isTwoLine = city.name.includes(" ");
        const size = NODE_SIZE[marker.role];

        return (
          <g key={marker.cityId} className={[styles.marker, styles[`marker_${marker.role}`]].join(" ")}>
            <circle cx={city.x} cy={city.y} r={size + 8} className={styles.markerHalo} />
            <rect
              x={city.x - size / 2}
              y={city.y - size / 2}
              width={size}
              height={size}
              rx={size / 3}
              className={styles.markerNode}
            />
            <text
              x={city.x}
              y={city.y - size - 8}
              textAnchor="middle"
              className={styles.markerLabel}
            >
              {isTwoLine ? city.name.split(" ")[0] : city.name}
            </text>
            {marker.note && (
              <text
                x={city.x}
                y={city.y + size + 16}
                textAnchor="middle"
                className={styles.markerNote}
              >
                {marker.note}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}