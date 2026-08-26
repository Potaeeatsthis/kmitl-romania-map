// scripts/fetch_road_geometry.mjs
//
// Fetches real road geometry from the public OSRM demo server for all 23 roads
// in the Romania graph, projects them into SVG space, simplifies with
// Douglas-Peucker, snaps endpoints to committed city positions, and writes
// lib/roadGeometry.ts.
//
// Run manually: node scripts/fetch_road_geometry.mjs
// Never at build time. Never by a visitor.

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { project } from "./lib/project.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));

// ---------- Read the committed graph ----------

const graphSource = readFileSync(`${REPO}/lib/romaniaGraph.ts`, "utf8");

// Parse cities
const cityMatches = [...graphSource.matchAll(/\{\s*id:\s*(\d+)\s*,\s*name:\s*"([^"]+)"\s*,\s*x:\s*([\d.]+)\s*,\s*y:\s*([\d.]+)\s*\}/g)];
const cities = cityMatches.map((m) => ({
  id: Number(m[1]),
  name: m[2],
  x: Number(m[3]),
  y: Number(m[4]),
}));
if (cities.length !== 20) {
  console.error(`Expected 20 cities, found ${cities.length}`);
  process.exit(1);
}

// Parse roads
const roadMatches = [...graphSource.matchAll(/\[\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\]/g)];
const roads = roadMatches.map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
if (roads.length !== 23) {
  console.error(`Expected 23 roads, found ${roads.length}`);
  process.exit(1);
}

// ---------- Real-world coordinates for routing ----------

const CITY_COORDS = [
  { id: 0, lon: 21.3123, lat: 46.1866 },
  { id: 1, lon: 21.5167, lat: 46.6167 },
  { id: 2, lon: 21.9211, lat: 47.0722 },
  { id: 3, lon: 24.1256, lat: 45.7983 },
  { id: 4, lon: 21.2087, lat: 45.7489 },
  { id: 5, lon: 21.9033, lat: 45.6886 },
  { id: 6, lon: 22.3667, lat: 44.9042 },
  { id: 7, lon: 22.6597, lat: 44.6369 },
  { id: 8, lon: 23.7949, lat: 44.3302 },
  { id: 9, lon: 24.3754, lat: 45.1047 },
  { id: 10, lon: 24.8692, lat: 44.8565 },
  { id: 11, lon: 24.9731, lat: 45.8416 },
  { id: 12, lon: 26.1025, lat: 44.4268 },
  { id: 13, lon: 25.9699, lat: 43.9037 },
  { id: 14, lon: 26.6333, lat: 44.7167 },
  { id: 15, lon: 27.9469, lat: 44.6889 },
  { id: 16, lon: 28.6333, lat: 44.0589 },
  { id: 17, lon: 27.7276, lat: 46.6407 },
  { id: 18, lon: 27.6014, lat: 47.1585 },
  { id: 19, lon: 26.3708, lat: 46.9275 },
];

// ---------- Douglas-Peucker simplification ----------

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist <= epsilon) {
    return [first, last];
  }

  const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

// ---------- Endpoint snapping with rubber-sheet correction ----------

function computeArcLengths(points) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return lengths;
}

function snapEndpoints(points, committedStart, committedEnd) {
  if (points.length < 2) return points;

  const arcLengths = computeArcLengths(points);
  const totalLength = arcLengths[arcLengths.length - 1];

  const dStartX = committedStart.x - points[0].x;
  const dStartY = committedStart.y - points[0].y;
  const dEndX = committedEnd.x - points[points.length - 1].x;
  const dEndY = committedEnd.y - points[points.length - 1].y;

  return points.map((point, i) => {
    const t = totalLength > 0 ? arcLengths[i] / totalLength : (i / (points.length - 1));
    return {
      x: point.x + dStartX * (1 - t) + dEndX * t,
      y: point.y + dStartY * (1 - t) + dEndY * t,
    };
  });
}

// ---------- OSRM fetching ----------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRoute(fromCoord, toCoord, roadLabel) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromCoord.lon},${fromCoord.lat};${toCoord.lon},${toCoord.lat}?overview=full&geometries=geojson`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OSRM request failed for road ${roadLabel}: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.routes || json.routes.length === 0) {
    throw new Error(`OSRM returned no route for road ${roadLabel}`);
  }

  const coordinates = json.routes[0].geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    throw new Error(`OSRM returned fewer than 2 coordinates for road ${roadLabel}`);
  }

  return coordinates; // Array of [lon, lat]
}

// ---------- Main ----------

async function main() {
  const EPSILON = 0.75; // Douglas-Peucker epsilon in projected px
  const geometry = {};

  console.log("Fetching road geometry from OSRM...\n");

  for (let i = 0; i < roads.length; i++) {
    const [fromId, toId] = roads[i];
    const key = `${Math.min(fromId, toId)}-${Math.max(fromId, toId)}`;
    const fromCoord = CITY_COORDS[fromId];
    const toCoord = CITY_COORDS[toId];
    const fromCity = cities.find((c) => c.id === fromId);
    const toCity = cities.find((c) => c.id === toId);
    const label = `${fromCity.name} → ${toCity.name} (${key})`;

    if (i > 0) await sleep(1000); // Be polite

    process.stdout.write(`  [${i + 1}/23] ${label}... `);

    let coordinates;
    try {
      coordinates = await fetchRoute(fromCoord, toCoord, label);
    } catch (err) {
      console.error(`\nFATAL: ${err.message}`);
      process.exit(1);
    }

    // Project all coordinates into SVG space
    let projectedPoints = coordinates.map(([lon, lat]) => project(lon, lat));

    // Simplify with Douglas-Peucker
    projectedPoints = douglasPeucker(projectedPoints, EPSILON);

    // Determine the committed endpoints — points stored ascending-id order
    const lowId = Math.min(fromId, toId);
    const highId = Math.max(fromId, toId);
    const committedStart = cities.find((c) => c.id === lowId);
    const committedEnd = cities.find((c) => c.id === highId);

    // If the route was fetched in descending order, reverse points
    if (fromId > toId) {
      projectedPoints.reverse();
    }

    // Snap endpoints with rubber-sheet correction
    projectedPoints = snapEndpoints(projectedPoints, committedStart, committedEnd);

    // Round to 2 decimal places
    const rounded = projectedPoints.map((p) => [
      Math.round(p.x * 100) / 100,
      Math.round(p.y * 100) / 100,
    ]);

    geometry[key] = rounded;
    console.log(`${rounded.length} points`);
  }

  // ---------- Write the output ----------

  const keys = Object.keys(geometry).sort((a, b) => {
    const [a1, a2] = a.split("-").map(Number);
    const [b1, b2] = b.split("-").map(Number);
    return a1 !== b1 ? a1 - b1 : a2 - b2;
  });

  let output = `// lib/roadGeometry.ts
//
// Real Romanian road geometry for the 23 graph edges, projected into the
// same SVG space as lib/countyOutlines.ts and the city positions.
//
// Generated by scripts/fetch_road_geometry.mjs -- do not hand-edit.
// Purely a visual layer: the search still uses the textbook km weights in
// lib/romaniaGraph.ts, which are NOT the real road distances.

export type RoadPoint = [number, number];

export const roadGeometry: Record<string, RoadPoint[]> = {\n`;

  for (const key of keys) {
    const points = geometry[key];
    const pointsStr = points.map(([x, y]) => `[${x}, ${y}]`).join(", ");
    output += `  "${key}": [${pointsStr}],\n`;
  }

  output += "};\n";

  const outPath = `${REPO}/lib/roadGeometry.ts`;
  writeFileSync(outPath, output);

  // ---------- Verification ----------

  console.log(`\n--- Verification ---`);
  console.log(`Keys: ${keys.length} (expected 23)`);
  if (keys.length !== 23) {
    console.error("FAIL: Not exactly 23 keys");
    process.exit(1);
  }

  let anyFail = false;
  for (const key of keys) {
    const [aId, bId] = key.split("-").map(Number);
    const points = geometry[key];
    const committedA = cities.find((c) => c.id === aId);
    const committedB = cities.find((c) => c.id === bId);
    const first = points[0];
    const last = points[points.length - 1];

    if (first[0] !== committedA.x || first[1] !== committedA.y) {
      console.error(`FAIL: ${key} first point [${first}] != committed [${committedA.x}, ${committedA.y}]`);
      anyFail = true;
    }
    if (last[0] !== committedB.x || last[1] !== committedB.y) {
      console.error(`FAIL: ${key} last point [${last}] != committed [${committedB.x}, ${committedB.y}]`);
      anyFail = true;
    }
    for (const [x, y] of points) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        console.error(`FAIL: ${key} has NaN or non-finite coordinate`);
        anyFail = true;
        break;
      }
    }
  }

  if (anyFail) {
    console.error("\nFATAL: Verification failed. File may be invalid.");
    process.exit(1);
  }

  const stats = statSync(outPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
  if (stats.size > 60 * 1024) {
    console.error("FAIL: File exceeds 60 KB");
    process.exit(1);
  }

  console.log("\nPoint counts per road:");
  for (const key of keys) {
    console.log(`  ${key}: ${geometry[key].length} points`);
  }

  console.log("\nPASS: lib/roadGeometry.ts generated and verified.");
}

main();
