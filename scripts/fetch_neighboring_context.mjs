// scripts/fetch_neighboring_context.mjs
//
// Fetches borders (Natural Earth 50m) for every country whose
// territory actually falls within the map's viewport -- not just Romania's
// five direct neighbors, but also whatever peeks into a corner (Slovakia,
// Poland, Croatia, Bosnia, ...) -- plus the Black Sea, projects them into the
// same SVG space as lib/countyOutlines.ts, clips them to the map's viewport,
// and writes lib/neighboringContext.ts.
//
// Purely a visual backdrop -- these shapes are never read by search logic,
// so "coarse" and "not perfectly precise at the frame edge" are both fine.
//
// Run manually: node scripts/fetch_neighboring_context.mjs
// Never at build time. Never by a visitor.

import { statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { project } from "./lib/project.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));

// 50m, not 110m: Romania's own county borders (lib/countyOutlines.ts) come
// from a much more detailed source, so 110m's very blocky neighbor borders
// stood out next to them. 50m is still small and fast to simplify, just a
// meaningfully closer match to how natural a real coastline/border looks.
const COUNTRIES_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

// The map's viewBox now stretches to match the panel's actual rendered aspect
// ratio (see getEffectiveMapExtent in SearchMap.tsx), which can reveal more
// than Romania's tight bounds in either direction depending on the visitor's
// window shape. This is sized to cover MAP_ASPECT_BOUNDS there (a wide
// ultrawide-ish window on one end, a tall/narrow one on the other), padded by
// ~20px so nothing is visibly clipped right at the frame edge. Widening this
// further means fetching more countries below -- it is not free.
// minX pushed out a bit further than the wide-aspect cap strictly needs
// (see MAP_MAX_ASPECT in SearchMap.tsx) specifically so the Adriatic Sea and
// Croatia's actual coastline have room to sit inside the frame with a small
// buffer, rather than landing exactly on the visible edge.
const CLIP_BOUNDS = { minX: -520, minY: -400, maxX: 1520, maxY: 1150 };

// Cheap pre-filter on raw lon/lat, generous enough that it can only over-include
// (e.g. Russia's or Turkey's bounding box technically brushes this window even
// though neither actually reaches our frame -- the real clip below drops
// those). Keeps the script from projecting every one of the ~180 countries in
// the dataset, most of which are nowhere near Romania. Must stay wide enough
// to cover CLIP_BOUNDS above with margin.
const CANDIDATE_LON_LAT_BOUNDS = { minLon: 11, maxLon: 37, minLat: 38, maxLat: 54 };

// Every country whose territory falls in the viewport gets drawn, but only
// Romania's actual direct neighbors get a name label -- labeling Poland,
// Czechia, Croatia, Bosnia, Montenegro, Kosovo and Albania too (all of which
// only clip a small corner of the frame) reads as clutter, not context.
const LABELED_NAMES = new Set(["Hungary", "Republic of Serbia", "Bulgaria", "Ukraine", "Moldova"]);

// Rings (an island, an exclave, a clip-off sliver) smaller than this diagonal
// are dropped entirely rather than drawn -- see the Croatia comment below.
const MIN_FRAGMENT_DIAGONAL = 25;

function ringBboxDiagonal(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

// ---------- Douglas-Peucker simplification (same algorithm as fetch_road_geometry.mjs) ----------

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

// ---------- Sutherland-Hodgman polygon clipping against an axis-aligned box ----------

function clipEdge(points, inside, intersect) {
  if (points.length === 0) return points;
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const previous = points[(i - 1 + points.length) % points.length];
    const currentIn = inside(current);
    const previousIn = inside(previous);
    if (currentIn) {
      if (!previousIn) output.push(intersect(previous, current));
      output.push(current);
    } else if (previousIn) {
      output.push(intersect(previous, current));
    }
  }
  return output;
}

function clipPolygon(points, bounds) {
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

  let result = points;
  result = clipEdge(
    result,
    (p) => p.x >= bounds.minX,
    (a, b) => lerp(a, b, (bounds.minX - a.x) / (b.x - a.x)),
  );
  result = clipEdge(
    result,
    (p) => p.x <= bounds.maxX,
    (a, b) => lerp(a, b, (bounds.maxX - a.x) / (b.x - a.x)),
  );
  result = clipEdge(
    result,
    (p) => p.y >= bounds.minY,
    (a, b) => lerp(a, b, (bounds.minY - a.y) / (b.y - a.y)),
  );
  result = clipEdge(
    result,
    (p) => p.y <= bounds.maxY,
    (a, b) => lerp(a, b, (bounds.maxY - a.y) / (b.y - a.y)),
  );
  return result;
}

// ---------- Geometry helpers ----------

function ringsFromGeometry(geometry) {
  // Returns an array of outer rings, each an array of [lon, lat].
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0]];
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((polygon) => polygon[0]);
  }
  return [];
}

function lonLatBounds(rings) {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

function boundsOverlap(a, b) {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
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

// Our own Romania county outlines and Natural Earth's country borders are two
// different datasets tracing the same real border, so they don't land on
// identical pixels -- a thin gap of bare background shows through between
// Romania's edge and its neighbor's edge. Inflating each neighbor ring a few
// units outward from its own centroid (before clipping, so the direction is
// governed by the country's full shape, not just the sliver near Romania)
// pushes it under Romania's own opaque layers, which paint on top and hide
// the overlap. Crude compared to a real polygon buffer, but the shapes are
// backdrop-only, so "slightly bigger" is invisible except at that seam.
// 50m data tracks Romania's real border far more closely than 110m did, so
// the seam is much smaller to begin with -- and a naive per-vertex push like
// inflateOutward always risks flipping any concave inlet narrower than 2x
// this amount, which Ukraine's and Serbia's real coastlines/borders have
// several of. Measured by sweeping every labeled neighbor's shape for actual
// self-intersections (see the bug this replaced): 3 is the largest value
// that keeps all five to at most one small, isolated crossing rather than
// the dozens a bigger push produced.
const NEIGHBOR_OVERLAP = 3;

function centroid(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

// A real (approximate) polygon dilate: push every vertex outward along its
// own local edge normal, not away from one distant whole-shape centroid.
// Romania's county borders are still more detailed than this 50m neighbor
// data, so a centroid-based push doesn't reach into the small notches of
// Romania's own jagged edge -- it only bulges the neighbor's smooth outline
// as a whole. A local normal follows every jag, closing gaps evenhandedly.
function inflateOutward(points, amount) {
  const n = points.length;
  const normals = points.map((p, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    let nx = 0;
    let ny = 0;
    const d1x = p.x - prev.x;
    const d1y = p.y - prev.y;
    const len1 = Math.hypot(d1x, d1y) || 1;
    nx += -d1y / len1;
    ny += d1x / len1;
    const d2x = next.x - p.x;
    const d2y = next.y - p.y;
    const len2 = Math.hypot(d2x, d2y) || 1;
    nx += -d2y / len2;
    ny += d2x / len2;
    const nLen = Math.hypot(nx, ny) || 1;
    return { x: nx / nLen, y: ny / nLen };
  });

  // The local-normal convention above doesn't know which side is "outward"
  // for this ring's winding order -- decide once, empirically: outward
  // normals should point away from the polygon's own centroid on average.
  const center = centroid(points);
  let sign = 0;
  for (let i = 0; i < n; i++) {
    sign += normals[i].x * (points[i].x - center.x) + normals[i].y * (points[i].y - center.y);
  }
  const direction = sign >= 0 ? 1 : -1;

  return points.map((p, i) => ({
    x: p.x + normals[i].x * amount * direction,
    y: p.y + normals[i].y * amount * direction,
  }));
}

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

function distanceToNearestEdge(point, ring) {
  let min = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    min = Math.min(min, Math.hypot(point.x - cx, point.y - cy));
  }
  return min;
}

// Ukraine wraps around Moldova on this map, so its shape is a concave "C" --
// a plain area centroid for a concave ring can (and here, does) land outside
// the polygon entirely, in the very notch Moldova sits in. This instead grid
// -searches the bounding box for the point deepest inside the shape (a cheap
// approximation of a "pole of inaccessibility"), which always lands on the
// country it's labeling.
// The map's dynamic viewBox (getEffectiveMapExtent in SearchMap.tsx) only ever
// grows width OR height past this rectangle -- it never shrinks below it -- so
// this region is visible under every window shape the map supports. A country
// clipped to the much bigger CLIP_BOUNDS above can have its deepest point (the
// spot visualCenter would otherwise pick) well outside it, in territory that's
// only actually on screen for some window shapes: exactly the "Ukraine's/
// Bulgaria's label is barely visible" symptom this restricts the search to
// avoid. Derived from BASE_MAP_EXTENT in components/search/SearchMap.tsx
// (must match), inset by a small margin so a label never sits flush against
// the very edge of the safe zone -- see labelPosition below for how this is
// actually used (clipping the shape, not just restricting the search box).
const LABEL_MARGIN = 20;
const ALWAYS_VISIBLE_BOUNDS = {
  minX: -60 + LABEL_MARGIN,
  minY: -60 + LABEL_MARGIN,
  maxX: 1140 - LABEL_MARGIN,
  maxY: 810 - LABEL_MARGIN,
};

function visualCenter(ring) {
  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const steps = 48;
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const point = { x: minX + ((maxX - minX) * i) / steps, y: minY + ((maxY - minY) * j) / steps };
      if (!pointInPolygon(point, ring)) continue;
      const score = distanceToNearestEdge(point, ring);
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
  }
  return best ?? centroid(ring);
}

// Restricting visualCenter's *search box* to the always-visible region isn't
// enough on its own: if a country only pokes a thin sliver into that region
// (Ukraine, mostly outside it even before this map was widened), the deepest
// point of that sliver sits right on the region's own boundary -- exactly as
// clipped-looking as the symptom this is meant to fix. Actually clipping the
// polygon to the region first, then finding the deepest point of that real
// sub-shape, doesn't have that failure mode.
function labelPosition(ring) {
  const clipped = clipPolygon(ring, ALWAYS_VISIBLE_BOUNDS);
  // Shouldn't happen for an actual Romania neighbor, but fall back to the
  // unclipped shape rather than mislabel it if it somehow doesn't reach here.
  if (clipped.length < 3) return visualCenter(ring);
  return visualCenter(clipped);
}

function processRing(lonLatRing, { inflate = false } = {}) {
  let projected = lonLatRing.map(([lon, lat]) => project(lon, lat));
  if (inflate) {
    // The 50m source packs points much closer together than 110m did. Two
    // near-duplicate points give inflateOutward's per-vertex normal an almost
    // arbitrary direction (dominated by rounding, not the border's real
    // shape), which shows up as small spikes -- a "shark's teeth" pattern --
    // wherever the raw data has a tight little zigzag. Smoothing first gives
    // it a stable direction to push at every point, still detailed enough to
    // look like a real coastline once inflated and re-simplified below.
    const smoothed = douglasPeucker([...projected, projected[0]], 4);
    projected = inflateOutward(smoothed, NEIGHBOR_OVERLAP);
  }
  const clipped = clipPolygon(projected, CLIP_BOUNDS);
  if (clipped.length < 3) return null;
  const simplified = douglasPeucker([...clipped, clipped[0]], 1.5);
  return { d: ringToPathD(simplified), clipped };
}

// The Black Sea isn't its own dataset here -- it's built from Romania's own
// coastline (the contiguous run of ring points east of the land borders),
// closed off with a straight edge at the map's east frame. Good enough for
// a backdrop that was never meant to be more than "there's a sea over there".
function findCoastline(ring) {
  const body = ring.slice(0, -1); // ring is closed: first === last
  const isCoastal = ([lon, lat]) => lon > 27 && lat < 45.6;
  const start = body.findIndex((point, i) => isCoastal(point) && !isCoastal(body[(i - 1 + body.length) % body.length]));
  if (start === -1) throw new Error("Could not find Romania's coastline in the ring");
  const coastline = [];
  for (let i = 0; i < body.length; i++) {
    const point = body[(start + i) % body.length];
    if (!isCoastal(point)) break;
    coastline.push(point);
  }
  return coastline;
}

// `side` is which edge of CLIP_BOUNDS the sea lies against: "east" for the
// Black Sea (Romania's coast faces east), "west" for the Adriatic (Croatia's
// faces west). Everything else about the shape is identical either way, just
// mirrored.
function buildSeaPath(coastlineLonLat, side) {
  const coastline = coastlineLonLat.map(([lon, lat]) => project(lon, lat));
  const start = coastline[0];
  const end = coastline[coastline.length - 1];
  const edgeX = side === "east" ? CLIP_BOUNDS.maxX : CLIP_BOUNDS.minX;
  // Close off with the frame's own top and bottom edges (not just the
  // coastline's own extent) so the sea fills the full height of the visible
  // water instead of a thin band pinned to the coast. A right-angle cap
  // (straight to the frame's own edge, then along it) rather than a diagonal
  // straight to the far corner: a diagonal cuts across a huge swath of the
  // neighboring country's own territory, and the gap between that line and
  // its actual (much closer) edge is far too wide for any reasonable
  // border-overlap buffer to close.
  let ring = [
    { x: edgeX, y: CLIP_BOUNDS.minY },
    { x: start.x, y: CLIP_BOUNDS.minY },
    ...coastline,
    { x: end.x, y: CLIP_BOUNDS.maxY },
    { x: edgeX, y: CLIP_BOUNDS.maxY },
  ];
  // Same dataset mismatch as the land borders: a neighboring country's coastline
  // doesn't land on the same pixels as the coastline this shape is built from.
  // Inflate so the sea's landward edge reaches a little past theirs -- still
  // hidden behind their opaque fill everywhere except that seam, where it now
  // reads as sea instead of gap. Smoothed first for the same reason as
  // processRing: 50m's dense points give a naive per-vertex push spiky,
  // unstable directions.
  ring = inflateOutward(douglasPeucker([...ring, ring[0]], 4), NEIGHBOR_OVERLAP);
  const clipped = clipPolygon(ring, CLIP_BOUNDS);
  const simplified = douglasPeucker([...clipped, clipped[0]], 1.5);
  return ringToPathD(simplified);
}

// Croatia's coast runs from its southernmost point (near the Montenegro
// border) back up to Istria -- unlike Romania's short, easily-delimited
// coastal run, there's no simple lon/lat cutoff that isolates it from the
// inland Bosnia/Hungary/Serbia borders. The southernmost point is reliably
// on the coast, and Natural Earth's ring order happens to run the rest of
// the way up the coast to Istria from there, so this needs no threshold.
function findCroatiaCoastline(ring) {
  const body = ring.slice(0, -1);
  let minLatIndex = 0;
  for (let i = 1; i < body.length; i++) {
    if (body[i][1] < body[minLatIndex][1]) minLatIndex = i;
  }
  return body.slice(minLatIndex);
}

// ---------- Main ----------

async function main() {
  console.log("Fetching Natural Earth 50m country boundaries...\n");

  const countriesResponse = await fetch(COUNTRIES_URL);
  if (!countriesResponse.ok) throw new Error(`Countries fetch failed: HTTP ${countriesResponse.status}`);

  const countries = await countriesResponse.json();

  const romania = countries.features.find((f) => f.properties.ADMIN === "Romania");
  if (!romania) throw new Error("Could not find Romania in the countries dataset");
  const romaniaRing = ringsFromGeometry(romania.geometry)[0];

  const croatia = countries.features.find((f) => f.properties.ADMIN === "Croatia");
  if (!croatia) throw new Error("Could not find Croatia in the countries dataset");
  const croatiaRings = ringsFromGeometry(croatia.geometry);
  const croatiaMainland = croatiaRings.reduce((a, b) => (b.length > a.length ? b : a));

  const candidates = countries.features.filter((f) => {
    if (f.properties.ADMIN === "Romania") return false;
    const rings = ringsFromGeometry(f.geometry);
    if (rings.length === 0) return false;
    return boundsOverlap(lonLatBounds(rings), CANDIDATE_LON_LAT_BOUNDS);
  });
  console.log(`Checking ${candidates.length} candidates against the map frame...\n`);

  const neighbors = [];
  for (const feature of candidates) {
    const name = feature.properties.ADMIN || feature.properties.NAME;
    const rings = ringsFromGeometry(feature.geometry);
    let processed = rings
      .map((ring) => processRing(ring, { inflate: true }))
      .filter((r) => r !== null && ringBboxDiagonal(r.clipped) >= MIN_FRAGMENT_DIAGONAL);
    // Croatia alone clips to 13 separate rings here (real Adriatic islands, not
    // degenerate slivers -- MIN_FRAGMENT_DIAGONAL above doesn't touch them). Individually
    // harmless, but packed together at this scale and this style they read as visual
    // noise/clutter ("border mismatch") rather than useful context. Only Romania's
    // actual neighbors are labeled/important enough to be worth their extra pieces
    // (a real coastal island, say); every other country is decoration, so keep just
    // its main body.
    if (!LABELED_NAMES.has(name) && processed.length > 1) {
      processed = [processed.reduce((a, b) => (ringBboxDiagonal(b.clipped) > ringBboxDiagonal(a.clipped) ? b : a))];
    }
    if (processed.length === 0) continue; // bbox brushed the frame, but no actual geometry landed inside it

    // Label the largest visible ring (by point count, a cheap stand-in for
    // area at this resolution) so a country split by clipping into a sliver
    // and a main body gets labeled on the body -- but only for an actual
    // direct neighbor of Romania (see LABELED_NAMES).
    const biggest = processed.reduce((a, b) => (b.clipped.length > a.clipped.length ? b : a));
    const label = LABELED_NAMES.has(name) ? labelPosition(biggest.clipped) : null;

    console.log(`  ${name}: ${processed.length} ring(s)${label ? "" : " (unlabeled)"}`);
    neighbors.push({ name, paths: processed.map((r) => r.d), label });
  }

  const blackSeaCoastline = findCoastline(romaniaRing);
  const adriaticCoastline = findCroatiaCoastline(croatiaMainland);
  const seaPaths = [buildSeaPath(blackSeaCoastline, "east"), buildSeaPath(adriaticCoastline, "west")];
  console.log(`  Black Sea: derived from a ${blackSeaCoastline.length}-point coastline run`);
  console.log(`  Adriatic Sea: derived from a ${adriaticCoastline.length}-point coastline run`);

  // ---------- Write the output ----------

  let output = `// lib/neighboringContext.ts
//
// Shapes (Natural Earth 50m) for every country visible in the viewport --
// every country whose territory falls within the map's viewport -- plus the
// Black Sea, projected into the same SVG space as lib/countyOutlines.ts and
// clipped to the map's viewport. Purely a visual backdrop so Romania doesn't
// float in empty space; never read by search logic and deliberately low
// detail. A country clipped to only a sliver has no label (see
// MIN_LABELED_BBOX_DIAGONAL in the generator) so it doesn't read as clutter.
//
// Generated by scripts/fetch_neighboring_context.mjs -- do not hand-edit.

export type NeighboringCountry = { name: string; paths: string[]; label: { x: number; y: number } | null };

export const neighboringCountries: NeighboringCountry[] = [\n`;

  for (const country of neighbors) {
    const pathsStr = country.paths.map((d) => JSON.stringify(d)).join(", ");
    const label = country.label ? `{ x: ${country.label.x.toFixed(2)}, y: ${country.label.y.toFixed(2)} }` : "null";
    output += `  { name: ${JSON.stringify(country.name)}, paths: [${pathsStr}], label: ${label} },\n`;
  }

  output += `];\n\nexport const seaAreas: string[] = [\n`;
  for (const d of seaPaths) {
    output += `  ${JSON.stringify(d)},\n`;
  }
  output += "];\n";

  const outPath = `${REPO}/lib/neighboringContext.ts`;
  writeFileSync(outPath, output);

  const stats = statSync(outPath);
  console.log(`\nFile size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log("\nPASS: lib/neighboringContext.ts generated.");
}

main().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
