// scripts/fetch_romania_landcover.mjs
//
// Fetches Romania's actual urban-area footprints (Natural Earth 10m) and its
// named lakes/lagoons (Natural Earth 10m Europe lakes), projects them into the
// same SVG space as lib/countyOutlines.ts, keeps only the shapes that fall
// inside Romania's own border, and writes lib/romaniaLandcover.ts.
//
// Purely decorative texture drawn on top of the county fill in Default mode --
// mimics the small forest/water/urban detail real "Dark Matter"-style
// basemaps render. Never read by search logic, so "coarse" is fine.
//
// Run manually: node scripts/fetch_romania_landcover.mjs
// Never at build time. Never by a visitor.

import { statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { project } from "./lib/project.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));

const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
// Global dataset (~11.9k features) -- has no per-feature country field, so
// membership is decided below by point-in-polygon against Romania's own
// border rather than a property filter.
const URBAN_AREAS_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_urban_areas.geojson";
// The Europe-specific lakes cut (not the global ne_10m_lakes, which has zero
// features anywhere near Romania) -- this is the one that actually carries
// Romania's Danube Delta lagoons (Lacul Brateș, Babadag, Dranov, Taşaul,
// Isacov, Oltina, ...).
const LAKES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes_europe.geojson";

// Cheap pre-filter on raw lon/lat, generous enough to only over-include --
// the real point-in-polygon check below is what actually decides membership.
const ROMANIA_LON_LAT_BOUNDS = { minLon: 20.2, maxLon: 29.8, minLat: 43.5, maxLat: 48.3 };

function ringsFromGeometry(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

function lonLatBounds(ring) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, maxLon, minLat, maxLat };
}

function boundsOverlap(a, b) {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

// ---------- Douglas-Peucker simplification (same algorithm as fetch_neighboring_context.mjs) ----------

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
  if (maxDist <= epsilon) return [first, last];
  const left = douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
  const right = douglasPeucker(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

// ---------- Point-in-polygon (same algorithm as fetch_neighboring_context.mjs) ----------

function pointInPolygon(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses = a.y > point.y !== b.y > point.y;
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function centroid(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function ringToPathD(ring) {
  if (ring.length < 3) return null;
  const round = (n) => Math.round(n * 100) / 100;
  let d = `M ${round(ring[0].x)},${round(ring[0].y)}`;
  for (let i = 1; i < ring.length; i++) {
    d += ` L ${round(ring[i].x)},${round(ring[i].y)}`;
  }
  return `${d} Z`;
}

async function fetchGeojson(url, label) {
  console.log(`Fetching ${label}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} fetch failed: HTTP ${response.status}`);
  return response.json();
}

// A feature "belongs" to Romania if its own centroid falls inside Romania's
// border. These are small, simple urban/lake blobs nowhere near the frame
// edge, so a plain centroid (unlike the neighboring-country layer's
// concave-shape handling) is enough.
function extractShapes(data, romaniaRingProjected, simplifyEpsilon) {
  const shapes = [];
  for (const feature of data.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    for (const ring of ringsFromGeometry(geometry)) {
      if (ring.length < 3) continue;
      if (!boundsOverlap(lonLatBounds(ring), ROMANIA_LON_LAT_BOUNDS)) continue;
      const projected = ring.map(([lon, lat]) => project(lon, lat));
      if (!pointInPolygon(centroid(projected), romaniaRingProjected)) continue;
      const simplified = douglasPeucker([...projected, projected[0]], simplifyEpsilon);
      const d = ringToPathD(simplified);
      if (d) shapes.push(d);
    }
  }
  return shapes;
}

async function main() {
  const countries = await fetchGeojson(COUNTRIES_URL, "Natural Earth 50m country boundaries");
  const romania = countries.features.find((f) => f.properties.ADMIN === "Romania");
  if (!romania) throw new Error("Could not find Romania in the countries dataset");
  const romaniaRingProjected = ringsFromGeometry(romania.geometry)[0].map(([lon, lat]) => project(lon, lat));

  const urbanData = await fetchGeojson(URBAN_AREAS_URL, "Natural Earth 10m urban areas");
  const lakesData = await fetchGeojson(LAKES_URL, "Natural Earth 10m Europe lakes");

  const urbanAreas = extractShapes(urbanData, romaniaRingProjected, 0.6);
  const lakes = extractShapes(lakesData, romaniaRingProjected, 0.6);

  console.log(`  Urban areas inside Romania: ${urbanAreas.length}`);
  console.log(`  Lakes inside Romania: ${lakes.length}`);

  let output = `// lib/romaniaLandcover.ts
//
// Small urban-area and lake shapes (Natural Earth 10m) that fall inside
// Romania's own border, projected into the same SVG space as
// lib/countyOutlines.ts. Purely decorative texture drawn on top of the county
// fill in Default mode -- mimics the subtle landcover detail real
// "Dark Matter"-style basemaps render. Never read by search logic.
//
// Generated by scripts/fetch_romania_landcover.mjs -- do not hand-edit.

export const urbanAreas: string[] = [\n`;
  for (const d of urbanAreas) output += `  ${JSON.stringify(d)},\n`;
  output += `];\n\nexport const lakes: string[] = [\n`;
  for (const d of lakes) output += `  ${JSON.stringify(d)},\n`;
  output += "];\n";

  const outPath = `${REPO}/lib/romaniaLandcover.ts`;
  writeFileSync(outPath, output);

  const stats = statSync(outPath);
  console.log(`\nFile size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log("\nPASS: lib/romaniaLandcover.ts generated.");
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
