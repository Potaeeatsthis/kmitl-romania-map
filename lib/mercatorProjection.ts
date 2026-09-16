// lib/mercatorProjection.ts
//
// Google Maps always renders in Web Mercator, where north-south distance
// scales with sec(latitude). Our own SVG geometry (romaniaGraph.ts,
// roadGeometry.ts) is deliberately linear equirectangular -- see
// countyOutlines.ts's header -- so the "Default" schematic view stays
// undistorted. The two projections agree on longitude but diverge on
// latitude, which is why a road drawn in our schematic space visibly drifts
// from Google's real road the further it runs from the view's center
// latitude. See docs/rootcause/terrain-border-mercator-mismatch.json.
//
// This module provides a parallel, precomputed Mercator-space copy of city
// positions and road geometry, used only when a Google background (Terrain
// or Satellite) is visible. The Default view keeps reading romaniaGraph.ts
// and roadGeometry.ts directly, untouched.

import { romaniaGraph } from "./romaniaGraph";
import { roadGeometry, type RoadPoint } from "./roadGeometry";

// Same equirectangular projection as scripts/lib/project.mjs (the two can't
// share an import: one is a build-time Node script, this is browser runtime
// code) -- inverse only, to turn an SVG-space point back into a lat/lng.
export const PROJECTION = { lonScale: 91.952899, lonOffset: -1726.368333, latScale: -131.39377, latOffset: 6415.664401 };

export function unprojectToLatLng(x: number, y: number) {
  return { lng: (x - PROJECTION.lonOffset) / PROJECTION.lonScale, lat: (y - PROJECTION.latOffset) / PROJECTION.latScale };
}

function mercatorY(latDeg: number) {
  const lat = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + lat / 2));
}

// Least-squares fit of a linear (scale, offset) map from mercatorY(lat) onto
// the same 20 committed city y-positions used to verify PROJECTION itself
// (see the rootcause file) -- lands almost exactly on today's city
// positions (RMSE 1.85px vs. today's 1.60px across all 20 cities) while
// correctly following true Mercator curvature between them, which is
// exactly the gap that produces the visible drift along road midpoints.
// Longitude is untouched: both projections scale it identically, so x is
// never recomputed here.
const MERCATOR_LAT_SCALE = -5267.490025467364;
const MERCATOR_LAT_OFFSET = 5146.3834194276;

export function equirectToMercatorXY(x: number, y: number): { x: number; y: number } {
  const { lat } = unprojectToLatLng(x, y);
  return { x, y: MERCATOR_LAT_SCALE * mercatorY(lat) + MERCATOR_LAT_OFFSET };
}

export const mercatorCityPositions: Map<number, { x: number; y: number }> = new Map(
  romaniaGraph.cities.map((city) => [city.id, equirectToMercatorXY(city.x, city.y)]),
);

export const mercatorRoadGeometry: Record<string, RoadPoint[]> = Object.fromEntries(
  Object.entries(roadGeometry).map(([key, points]) => [
    key,
    points.map(([x, y]): RoadPoint => {
      const projected = equirectToMercatorXY(x, y);
      return [projected.x, projected.y];
    }),
  ]),
);
