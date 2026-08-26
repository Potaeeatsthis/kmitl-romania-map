import { countyOutlines } from "./countyOutlines";
import { getRoadPoints } from "./roadPath";
import type { Point } from "./roadPath";

export type RouteDotDensity = "near" | "mid" | "far";

export type RouteCountyDot = Point & { density: RouteDotDensity };
export type RouteCountyDotField = { countyIndex: number; dots: RouteCountyDot[] };

const DOT_GRID_STEP = 11;
const NEAR_ROUTE_DISTANCE = 24;
const MID_ROUTE_DISTANCE = 58;

export const countyPolygons: Point[][] = countyOutlines.map((outline) => {
  const coordinates = outline.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: Point[] = [];
  for (let index = 0; index < coordinates.length; index += 2) {
    points.push({ x: coordinates[index], y: coordinates[index + 1] });
  }
  return points;
});

export function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const a = polygon[current];
    const b = polygon[previous];
    const crossesRay = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(point: Point, start: Point, end: Point) {
  return point.x >= Math.min(start.x, end.x)
    && point.x <= Math.max(start.x, end.x)
    && point.y >= Math.min(start.y, end.y)
    && point.y <= Math.max(start.y, end.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  if (((abC < 0 && abD > 0) || (abC > 0 && abD < 0))
    && ((cdA < 0 && cdB > 0) || (cdA > 0 && cdB < 0))) return true;
  return (abC === 0 && pointOnSegment(c, a, b))
    || (abD === 0 && pointOnSegment(d, a, b))
    || (cdA === 0 && pointOnSegment(a, c, d))
    || (cdB === 0 && pointOnSegment(b, c, d));
}

function polylineIntersectsPolygon(polyline: Point[], polygon: Point[]) {
  if (polyline.some((point) => pointInPolygon(point, polygon))) return true;
  for (let routeIndex = 1; routeIndex < polyline.length; routeIndex += 1) {
    for (let countyIndex = 0; countyIndex < polygon.length; countyIndex += 1) {
      if (segmentsIntersect(
        polyline[routeIndex - 1],
        polyline[routeIndex],
        polygon[countyIndex],
        polygon[(countyIndex + 1) % polygon.length],
      )) return true;
    }
  }
  return false;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + projection * dx),
    point.y - (start.y + projection * dy),
  );
}

function distanceToPolyline(point: Point, polyline: Point[]) {
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < polyline.length; index += 1) {
    distance = Math.min(distance, distanceToSegment(point, polyline[index - 1], polyline[index]));
  }
  return distance;
}

function getRoutePolyline(path: number[]) {
  const points: Point[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const roadPoints = getRoadPoints(path[index], path[index + 1]);
    points.push(...(index === 0 ? roadPoints : roadPoints.slice(1)));
  }
  return points;
}

function getBounds(points: Point[]) {
  return points.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxY: Math.max(bounds.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

export function getRouteCountyDots(path: number[], phase: number): RouteCountyDotField[] {
  const route = getRoutePolyline(path);
  if (route.length < 2) return [];
  const phaseIndex = phase < 0 ? 0 : 1;

  return countyPolygons.flatMap((polygon, countyIndex) => {
    if (!polylineIntersectsPolygon(route, polygon)) return [];
    const bounds = getBounds(polygon);
    const dots: RouteCountyDot[] = [];
    let row = 0;
    for (let y = bounds.minY + DOT_GRID_STEP / 2 + phaseIndex * 3; y <= bounds.maxY; y += DOT_GRID_STEP) {
      let column = 0;
      const rowOffset = ((row + phaseIndex) % 2) * (DOT_GRID_STEP / 2);
      for (let x = bounds.minX + DOT_GRID_STEP / 2 + rowOffset + phaseIndex * 3; x <= bounds.maxX; x += DOT_GRID_STEP) {
        const point = { x, y };
        if (pointInPolygon(point, polygon)) {
          const distance = distanceToPolyline(point, route);
          const density: RouteDotDensity = distance <= NEAR_ROUTE_DISTANCE
            ? "near"
            : distance <= MID_ROUTE_DISTANCE ? "mid" : "far";
          const include = density === "near"
            || (density === "mid" && (row + column + phaseIndex) % 2 === 0)
            || (density === "far" && row % 3 === phaseIndex && column % 3 === phaseIndex);
          if (include) dots.push({ ...point, density });
        }
        column += 1;
      }
      row += 1;
    }
    return [{ countyIndex, dots }];
  });
}
