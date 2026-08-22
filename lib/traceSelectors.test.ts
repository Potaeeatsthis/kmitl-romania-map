// lib/traceSelectors.test.ts
import { describe, expect, it } from "vitest";

import sampleData from "../public/data/arad-bucharest-search.json";
import type { SearchResponse } from "./types";
import {
  getExpandedCities,
  getFinalPath,
  getFrontierCities,
  getTimelineLength,
  getTraceFrame,
} from "./traceSelectors";

const sample = sampleData as SearchResponse;

describe("traceSelectors", () => {
  it("returns 0 when data is null", () => {
    expect(getTimelineLength(null)).toBe(0);
  });

  it("uses the longest algorithm trace as the timeline length", () => {
    expect(getTimelineLength(sample)).toBe(
      Math.max(sample.ucs.trace.length, sample.astar.trace.length),
    );
  });

  it("clamps an out-of-bounds step to the last frame", () => {
    expect(getTraceFrame(sample, "ucs", 100)).toBe(sample.ucs.trace.at(-1));
  });

  it("expanded cities include cities through the current step", () => {
    expect(getExpandedCities(sample, "ucs", 1)).toEqual(
      new Set(sample.ucs.explored_order.slice(0, 2)),
    );
  });

  it("returns only the cities in the current frontier", () => {
    const frame = sample.astar.trace[0];

    expect(getFrontierCities(frame)).toEqual(
      new Set(frame.frontier.map((node) => node.city)),
    );
  });

  it("shows final paths only for completed algorithms", () => {
    expect(getFinalPath(sample, true, false)).toEqual(new Set(sample.ucs.path));
    expect(getFinalPath(sample, false, false)).toEqual(new Set());
  });
});
