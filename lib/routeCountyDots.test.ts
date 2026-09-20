import { describe, expect, it } from "vitest";

import { countyOutlines } from "./countyOutlines";
import { countyPolygons, getRouteCountyDots, pointInPolygon } from "./routeCountyDots";

describe("routeCountyDots", () => {
  const aradToBucharest = [0, 1, 2, 9, 10, 12];

  it("parses every county outline into a polygon", () => {
    expect(countyPolygons).toHaveLength(countyOutlines.length);
    expect(countyPolygons.every((polygon) => polygon.length >= 3)).toBe(true);
  });

  it("returns dots only inside counties crossed by the route", () => {
    const fields = getRouteCountyDots(aradToBucharest, -3);

    expect(fields.length).toBeGreaterThan(1);
    expect(fields.length).toBeLessThan(countyOutlines.length);
    for (const field of fields) {
      expect(field.dots.length).toBeGreaterThan(0);
      for (const dot of field.dots) {
        expect(pointInPolygon(dot, countyPolygons[field.countyIndex])).toBe(true);
      }
    }
  });

  it("keeps near, middle, and far density tiers across the selected counties", () => {
    const densities = new Set(
      getRouteCountyDots(aradToBucharest, -3).flatMap((field) => field.dots.map((dot) => dot.density)),
    );

    expect(densities).toEqual(new Set(["near", "mid", "far"]));
  });
});
