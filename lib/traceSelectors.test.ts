import { describe, expect, it } from "vitest";
import {
  getTimelineLength,
  getTraceFrame,
  getExpandedCities,
  getFrontierCities,
} from "./traceSelectors";

describe("traceSelectors", () => {
  it("Property 1: returns 0 when data is null", () => {
    expect(getTimelineLength(null)).toBe(0);
  });

  it("Property 2: timeline length equals the longest trace", () => {
    const data = {
      ucs: {
        trace: Array.from({ length: 10 }, () => ({
          frontier: [],
        })),
      },
      astar: {
        trace: Array.from({ length: 15 }, () => ({
          frontier: [],
        })),
      },
    } as any;

    expect(getTimelineLength(data)).toBe(15);
  });

    it("Property 3: clamps an out-of-bounds step to the last frame", () => {
    const trace = [
      { frontier: [] },
      { frontier: [] },
      { frontier: [] },
      { frontier: [] },
      { frontier: [] },
    ];

    const data = {
      ucs: {
        trace,
      },
      astar: {
        trace: [],
      },
    } as any;

    const frame = getTraceFrame(data, "ucs", 100);

    expect(frame).toBe(trace[trace.length - 1]);
  });

  it("expanded cities include cities through the current step", () => {
    const data = {
      ucs: {
        trace: [],
        explored_order: [3, 7, 12],
      },
      astar: {
        trace: [],
        explored_order: [],
      },
    } as any;

    const result = getExpandedCities(data, "ucs", 1);

    expect(result).toEqual(new Set([3, 7]));
  });

    it("Property 4: frontier contains only the cities from frontier nodes", () => {
    const frame = {
      frontier: [
        { city: 3 },
        { city: 7 },
        { city: 12 },
      ],
    };

    const result = getFrontierCities(frame as any);

    expect(result).toEqual(new Set([3, 7, 12]));
  });
});