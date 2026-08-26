// lib/roadPath.ts
//
// Pure geometry helpers for rendering curved road paths on the SVG map.
// No React, no imports from components/ — same discipline as traceSelectors.ts.

import { roadGeometry } from "./roadGeometry";
import { romaniaGraph } from "./romaniaGraph";

export type Point = { x: number; y: number };

const cityById = new Map(romaniaGraph.cities.map((city) => [city.id, city]));

/**
 * Points for the road between two cities, in traversal order from -> to.
 * Falls back to the straight chord if the pair has no baked geometry.
 * Returns [] if either id is unknown (renders an empty <path>).
 */
export function getRoadPoints(from: number, to: number): Point[] {
  const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
  const raw = roadGeometry[key];

  const fromCity = cityById.get(from);
  const toCity = cityById.get(to);

  if (!fromCity || !toCity) return [];

  if (!raw) {
    // Straight-chord fallback
    return [
      { x: fromCity.x, y: fromCity.y },
      { x: toCity.x, y: toCity.y },
    ];
  }

  // Points are stored in ascending-id order; reverse if traversal goes high→low
  const points: Point[] = raw.map(([x, y]) => ({ x, y }));
  if (from > to) {
    points.reverse();
  }
  return points;
}

/** "M x,y L x,y L x,y" with coordinates rounded to 2 decimals. */
export function toPathD(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  const round = (n: number) => n.toFixed(2);
  let d = `M ${round(first.x)},${round(first.y)}`;
  for (const p of rest) {
    d += ` L ${round(p.x)},${round(p.y)}`;
  }
  return d;
}

/**
 * Polyline shifted perpendicular by `offset` px.
 *
 * The normal is (-dy, dx) normalised — the same convention polylineMidpoint
 * uses, and the same side the map used before roads became curved. For a
 * west-to-east road, a positive offset moves the line down the screen.
 *
 * Per-vertex normal is the normalised average of the incoming and outgoing
 * segment directions; endpoints use their single adjacent segment.
 * offset === 0 returns the input array unchanged.
 */
export function offsetPolyline(points: Point[], offset: number): Point[] {
  if (offset === 0) return points;
  if (points.length < 2) return points;

  const result: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    let nx = 0;
    let ny = 0;

    if (i > 0) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      nx += -dy / len;
      ny += dx / len;
    }

    if (i < points.length - 1) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      const len = Math.hypot(dx, dy) || 1;
      nx += -dy / len;
      ny += dx / len;
    }

    // Normalise the averaged normal
    const nLen = Math.hypot(nx, ny) || 1;
    nx /= nLen;
    ny /= nLen;

    result.push({
      x: points[i].x + nx * offset,
      y: points[i].y + ny * offset,
    });
  }

  return result;
}

/**
 * Arc-length midpoint of the polyline plus the unit normal there, so a label
 * can be pushed off the road the way roadLabelPosition does today.
 */
export function polylineMidpoint(points: Point[]): {
  x: number;
  y: number;
  nx: number;
  ny: number;
} {
  if (points.length === 0) {
    return { x: 0, y: 0, nx: 0, ny: -1 };
  }
  if (points.length === 1) {
    return { x: points[0].x, y: points[0].y, nx: 0, ny: -1 };
  }

  // Compute cumulative arc lengths
  const arcLengths = [0];
  for (let i = 1; i < points.length; i++) {
    arcLengths.push(
      arcLengths[i - 1] +
        Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y),
    );
  }
  const totalLength = arcLengths[arcLengths.length - 1];
  const halfLength = totalLength / 2;

  // Find the segment containing the midpoint
  let segIndex = 0;
  for (let i = 1; i < arcLengths.length; i++) {
    if (arcLengths[i] >= halfLength) {
      segIndex = i - 1;
      break;
    }
  }

  const segStart = arcLengths[segIndex];
  const segEnd = arcLengths[segIndex + 1];
  const segLength = segEnd - segStart;
  const t = segLength > 0 ? (halfLength - segStart) / segLength : 0;

  const x = points[segIndex].x + t * (points[segIndex + 1].x - points[segIndex].x);
  const y = points[segIndex].y + t * (points[segIndex + 1].y - points[segIndex].y);

  const dx = points[segIndex + 1].x - points[segIndex].x;
  const dy = points[segIndex + 1].y - points[segIndex].y;
  const len = Math.hypot(dx, dy) || 1;

  // Use the same convention as the old roadLabelPosition: normal points to the "left" of travel
  // Old code: x = midX - (deltaY / length) * offset, y = midY + (deltaX / length) * offset
  // That means normal is (-dy/len, dx/len)
  const nx = -dy / len;
  const ny = dx / len;

  return { x, y, nx, ny };
}

// ---------- Memoised path-d cache ----------

const pathDCache = new Map<string, string>();

/**
 * Memoised `d` string for an edge at a given offset. Keyed by
 * `${from}-${to}-${offset}`. The map is small and bounded: 23 edges times the
 * handful of offsets the map uses.
 */
export function getRoadPathD(from: number, to: number, offset: number): string {
  const cacheKey = `${from}-${to}-${offset}`;
  const cached = pathDCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let points = getRoadPoints(from, to);
  if (offset !== 0) {
    points = offsetPolyline(points, offset);
  }
  const d = toPathD(points);
  pathDCache.set(cacheKey, d);
  return d;
}
