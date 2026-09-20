// lib/roadPath.test.ts
import { describe, expect, it } from "vitest";

import { roadGeometry } from "./roadGeometry";
import { romaniaGraph } from "./romaniaGraph";
import {
  getRoadPoints,
  offsetPolyline,
  polylineMidpoint,
  toPathD,
  getRoadPathD,
} from "./roadPath";
import type { Point } from "./roadPath";

describe("roadPath", () => {
  const allRoads = romaniaGraph.roads.map(([from, to]) => [from, to] as const);

  describe("getRoadPoints", () => {
    it("returns the same points reversed when traversal direction flips, for all 23 roads", () => {
      for (const [from, to] of allRoads) {
        const forward = getRoadPoints(from, to);
        const backward = getRoadPoints(to, from);
        expect(backward).toEqual([...forward].reverse());
      }
    });

    it("first and last points equal committed city positions for all 23 roads", () => {
      for (const [from, to] of allRoads) {
        const points = getRoadPoints(from, to);
        const fromCity = romaniaGraph.cities[from];
        const toCity = romaniaGraph.cities[to];
        expect(points[0]).toEqual({ x: fromCity.x, y: fromCity.y });
        expect(points[points.length - 1]).toEqual({ x: toCity.x, y: toCity.y });
      }
    });

    it("returns exactly two city positions for a non-existent edge (straight-chord fallback)", () => {
      const points = getRoadPoints(0, 12); // Arad to Bucharest — not a direct road
      const arad = romaniaGraph.cities[0];
      const bucharest = romaniaGraph.cities[12];
      expect(points).toHaveLength(2);
      expect(points[0]).toEqual({ x: arad.x, y: arad.y });
      expect(points[1]).toEqual({ x: bucharest.x, y: bucharest.y });
    });

    it("returns [] for an unknown city id", () => {
      expect(getRoadPoints(0, 99)).toEqual([]);
    });
  });

  describe("offsetPolyline", () => {
    it("shifts a straight horizontal line by exactly offset in y and leaves x untouched", () => {
      const points: Point[] = [
        { x: 0, y: 100 },
        { x: 50, y: 100 },
        { x: 100, y: 100 },
      ];
      const offset = 5;
      const result = offsetPolyline(points, offset);

      for (let i = 0; i < points.length; i++) {
        expect(result[i].x).toBeCloseTo(points[i].x, 10);
        // Convention: normal is (-dy, dx), so a rightward line shifts +y.
        expect(result[i].y).toBeCloseTo(points[i].y + offset, 10);
      }
    });

    it("returns points unchanged when offset is 0", () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 50, y: 60 },
      ];
      const result = offsetPolyline(points, 0);
      expect(result).toBe(points); // Same reference
    });

    it("offsetPolyline and polylineMidpoint push to the same side", () => {
      const points: Point[] = [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ];
      const offset = 5;
      const shifted = offsetPolyline(points, offset);
      const mid = polylineMidpoint(points);

      // Both must move a point to the same side of the line.
      const offsetSign = Math.sign(shifted[0].y - points[0].y);
      const midpointSign = Math.sign(mid.ny * offset);
      expect(offsetSign).toBe(midpointSign);
      expect(offsetSign).not.toBe(0);
    });
  });

  describe("polylineMidpoint", () => {
    it("returns the geometric midpoint for a straight two-point line with a unit normal", () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ];
      const mid = polylineMidpoint(points);
      expect(mid.x).toBeCloseTo(50, 10);
      expect(mid.y).toBeCloseTo(0, 10);
      // Unit normal should have length 1
      const normalLength = Math.hypot(mid.nx, mid.ny);
      expect(normalLength).toBeCloseTo(1, 10);
    });

    it("returns the arc-length midpoint for a multi-segment line", () => {
      // L-shaped path: (0,0) → (100,0) → (100,100). Total length = 200, midpoint at length 100 = (100, 0)
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ];
      const mid = polylineMidpoint(points);
      expect(mid.x).toBeCloseTo(100, 10);
      expect(mid.y).toBeCloseTo(0, 10);
    });
  });

  describe("toPathD", () => {
    it("produces M/L commands with 2-decimal coordinates", () => {
      const points: Point[] = [
        { x: 1.234, y: 5.678 },
        { x: 9.1, y: 2.345 },
      ];
      const d = toPathD(points);
      expect(d).toBe("M 1.23,5.68 L 9.10,2.35");
    });

    it("returns empty string for empty points array", () => {
      expect(toPathD([])).toBe("");
    });

    it("produces only M command for single point", () => {
      const d = toPathD([{ x: 10, y: 20 }]);
      expect(d).toBe("M 10.00,20.00");
    });
  });

  describe("getRoadPathD", () => {
    it("returns a non-empty string for all 23 roads at offset 0", () => {
      for (const [from, to] of allRoads) {
        const d = getRoadPathD(from, to, 0);
        expect(d).toMatch(/^M /);
      }
    });

    it("returns a different path for positive vs negative offset", () => {
      const d1 = getRoadPathD(0, 1, 3);
      const d2 = getRoadPathD(0, 1, -3);
      expect(d1).not.toBe(d2);
    });
  });

  describe("roadGeometry coverage", () => {
    it("every road in romaniaGraph.ts has a matching key in roadGeometry", () => {
      for (const [from, to] of allRoads) {
        const key = `${Math.min(from, to)}-${Math.max(from, to)}`;
        expect(roadGeometry[key]).toBeDefined();
      }
    });

    it("roadGeometry has no keys that are not roads", () => {
      const roadKeys = new Set(
        allRoads.map(([from, to]) => `${Math.min(from, to)}-${Math.max(from, to)}`),
      );
      for (const key of Object.keys(roadGeometry)) {
        expect(roadKeys.has(key)).toBe(true);
      }
    });
  });
});
