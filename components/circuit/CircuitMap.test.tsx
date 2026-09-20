// components/circuit/CircuitMap.test.tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { computeViewBox } from "../heuristic/RouteMap";
import { DEPARTURE_MONO } from "../../lib/circuitLabelLayout";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { ConductanceEdge } from "../../lib/types";
import CircuitMap, { type CircuitMarker } from "./CircuitMap";
import { CircuitMotionControl, CircuitMotionProvider } from "./CircuitMotion";
import { installMatchMedia } from "./testMatchMedia";

const edges: ConductanceEdge[] = romaniaGraph.roads.map(([a, b, distance]) => ({
  city_a: a,
  city_b: b,
  distance,
  conductance: 1 / distance,
}));

// A plausible solved-circuit potential for every city. The exact values do
// not matter to label layout; they only feed the voltage text and edge labels.
const potential: Record<number, number> = {};
romaniaGraph.cities.forEach((city, index) => {
  potential[city.id] = Math.max(0, (20 - index) * 3.17);
});
potential[12] = 0; // Bucharest is the ground.

const markers: CircuitMarker[] = [
  { cityId: 3, role: "focus" },
  { cityId: 9, role: "chosen" },
  { cityId: 0, role: "considered" },
  { cityId: 1, role: "considered" },
  { cityId: 2, role: "considered" },
  { cityId: 4, role: "considered" },
  { cityId: 11, role: "considered" },
];

const cropIds = markers.map((marker) => marker.cityId);
const viewBox = computeViewBox(cropIds, 130);
const bounds = (() => {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return { x, y, w, h };
})();

const hotEdges = new Set(["3-9", "9-10", "10-12"]);
const consideredEdges = new Set(["3-0", "3-11", "0-4"]);

type ParsedRect = { x: number; y: number; w: number; h: number };

function parseRects(svg: SVGSVGElement): ParsedRect[] {
  return Array.from(svg.querySelectorAll("rect")).map((rect) => ({
    x: Number(rect.getAttribute("x")),
    y: Number(rect.getAttribute("y")),
    w: Number(rect.getAttribute("width")),
    h: Number(rect.getAttribute("height")),
  }));
}

function overlaps(a: ParsedRect, b: ParsedRect, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

function inside(rect: ParsedRect): boolean {
  return (
    rect.x >= bounds.x - 1e-6 &&
    rect.y >= bounds.y - 1e-6 &&
    rect.x + rect.w <= bounds.x + bounds.w + 1e-6 &&
    rect.y + rect.h <= bounds.y + bounds.h + 1e-6
  );
}

function renderMap() {
  const { container } = render(
    <CircuitMap
      viewBox={viewBox}
      edges={edges}
      potential={potential}
      markers={markers}
      hotEdges={hotEdges}
      consideredEdges={consideredEdges}
    />,
  );
  return container.querySelector("svg") as SVGSVGElement;
}

describe("CircuitMap label layout", () => {
  it("keeps every city and voltage label inside the viewBox", () => {
    const svg = renderMap();
    const rects = parseRects(svg);
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(inside(rect)).toBe(true);
    }
  });

  it("never lets two label pills overlap", () => {
    const svg = renderMap();
    const rects = parseRects(svg);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j], 0.5)).toBe(false);
      }
    }
  });

  it("keeps label pills clear of the city node circles", () => {
    const svg = renderMap();
    const rects = parseRects(svg);
    const nodes = Array.from(svg.querySelectorAll('circle[class*="nodeCircle"]')).map((node) => ({
      x: Number(node.getAttribute("cx")),
      y: Number(node.getAttribute("cy")),
      r: Number(node.getAttribute("r")),
    }));
    expect(nodes.length).toBe(markers.length);
    for (const rect of rects) {
      for (const node of nodes) {
        const nearestX = Math.min(Math.max(node.x, rect.x), rect.x + rect.w);
        const nearestY = Math.min(Math.max(node.y, rect.y), rect.y + rect.h);
        expect(
          Math.hypot(node.x - nearestX, node.y - nearestY),
          "pill overlaps a node",
        ).toBeGreaterThanOrEqual(node.r - 1e-6);
      }
    }
  });

  it("centres each text on its pill, cap-height and all", () => {
    const svg = renderMap();
    const rects = parseRects(svg);
    const texts = Array.from(svg.querySelectorAll("text"));
    expect(texts).toHaveLength(rects.length);
    texts.forEach((text, index) => {
      const rect = rects[index];
      const fontSize = parseFloat(text.style.fontSize);
      expect(fontSize).toBeGreaterThan(0);
      expect(Number(text.getAttribute("x"))).toBeCloseTo(rect.x + rect.w / 2, 4);
      expect(Number(text.getAttribute("y"))).toBeCloseTo(
        rect.y + rect.h / 2 + (DEPARTURE_MONO.capHeight * fontSize) / 2,
        4,
      );
      // The cap-height text fits inside the pill it was measured for.
      const capTop = Number(text.getAttribute("y")) - DEPARTURE_MONO.capHeight * fontSize;
      expect(capTop).toBeGreaterThanOrEqual(rect.y - 1e-6);
      expect(Number(text.getAttribute("y"))).toBeLessThanOrEqual(rect.y + rect.h + 1e-6);
    });
  });

  it("draws a leader line for labels that had to move", () => {
    const svg = renderMap();
    const leaders = svg.querySelectorAll('line[class*="leaderLine"]');
    expect(leaders.length).toBeGreaterThan(0);
    // Every leader is a real segment, not a zero-length artifact.
    leaders.forEach((line) => {
      const dx = Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"));
      const dy = Number(line.getAttribute("y2")) - Number(line.getAttribute("y1"));
      expect(Math.hypot(dx, dy)).toBeGreaterThan(0.5);
    });
  });
});

function renderMapWith(potential: Record<number, number>): SVGSVGElement {
  const { container } = render(
    <CircuitMap
      viewBox={viewBox}
      edges={edges}
      potential={potential}
      markers={markers}
      hotEdges={hotEdges}
      consideredEdges={consideredEdges}
    />,
  );
  return container.querySelector("svg") as SVGSVGElement;
}

/** Dots travelling along the faint edge `key` ("a-b"). */
function edgeDotCount(svg: SVGSVGElement, key: string): number {
  const path = svg.querySelector(`#circuit-edge-${key}-faint`);
  const group = path?.closest("g");
  return group ? group.querySelectorAll("animateMotion").length : -1;
}

describe("CircuitMap current flow", () => {
  // A real Gauss-Jordan solution for Arad (0) -> Oradea (2), rounded to four
  // decimals. Bucharest's whole eastern branch (Giurgiu, Urziceni, ...) hangs
  // off node 12, so the dangling subtree shares node 12's potential and its
  // roads carry no current.
  const realPotential: Record<number, number> = {
    0: 94.2447,
    1: 45.8313,
    2: 0,
    3: 53.5277,
    4: 86.7338,
    5: 79.6684,
    6: 75.2127,
    7: 70.4388,
    8: 62.8006,
    9: 57.5607,
    10: 58.9694,
    11: 54.8385,
    12: 57.6321,
    13: 57.6321,
    14: 57.6321,
    15: 57.6321,
    16: 57.6321,
    17: 57.6321,
    18: 57.6321,
    19: 57.6321,
  };

  it("draws no dots on a real dangling road, but keeps its wire", () => {
    const svg = renderMapWith(realPotential);
    // Bucharest-Giurgiu is a leaf: zero current, so no moving dot.
    expect(edgeDotCount(svg, "12-13")).toBe(0);
    // The rest of the dangling branch is equally still.
    expect(edgeDotCount(svg, "12-14")).toBe(0);
    expect(edgeDotCount(svg, "14-15")).toBe(0);
    // A road that does carry current still animates.
    expect(edgeDotCount(svg, "11-12")).toBeGreaterThan(0);
    // The zero-current wire itself is still drawn.
    expect(svg.querySelector("#circuit-edge-12-13-faint")).not.toBeNull();
  });

  const flatPotential = (): Record<number, number> =>
    Object.fromEntries(romaniaGraph.cities.map((city) => [city.id, 100]));

  it("classifies an equal-potential network as no flow", () => {
    const svg = renderMapWith(flatPotential());
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    // Every wire is still present.
    expect(svg.querySelectorAll('path[class*="wireLine"]').length).toBe(edges.length);
  });

  it("treats a roundoff-level potential difference as no flow", () => {
    const svg = renderMapWith({ ...flatPotential(), 1: 100 - 1e-9 });
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
  });

  it("keeps dots when the current is just above the tolerance", () => {
    const svg = renderMapWith({ ...flatPotential(), 1: 100 - 1e-6 });
    expect(edgeDotCount(svg, "0-1")).toBeGreaterThan(0);
  });
});

function renderMapInMotion(potential: Record<number, number>) {
  const { container } = render(
    <CircuitMotionProvider>
      <CircuitMotionControl />
      <CircuitMap
        viewBox={viewBox}
        edges={edges}
        potential={potential}
        markers={markers}
        hotEdges={hotEdges}
        consideredEdges={consideredEdges}
      />
    </CircuitMotionProvider>,
  );
  return container.querySelector("svg") as SVGSVGElement;
}

const arrowCount = (svg: SVGSVGElement) =>
  svg.querySelectorAll('path[class*="flowArrow"]').length;

/** Dots and arrows inside the group for edge `key` ("a-b"), any tier. */
function edgeMotion(svg: SVGSVGElement, key: string) {
  const path = svg.querySelector(`[id^="circuit-edge-${key}-"]`);
  const group = path?.closest("g");
  return {
    dots: group ? group.querySelectorAll("animateMotion").length : -1,
    arrows: group ? group.querySelectorAll('path[class*="flowArrow"]').length : -1,
  };
}

describe("CircuitMap motion control", () => {
  it("pauses every current dot and shows static direction arrows", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const svg = renderMapInMotion(potential);
    expect(svg.querySelectorAll("animateMotion").length).toBeGreaterThan(0);
    expect(arrowCount(svg)).toBe(0);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(arrowCount(svg)).toBeGreaterThan(0);
  });

  it("resumes motion when the reader presses Resume", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const svg = renderMapInMotion(potential);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    await user.click(screen.getByRole("button", { name: "Resume animation" }));

    expect(svg.querySelectorAll("animateMotion").length).toBeGreaterThan(0);
    expect(arrowCount(svg)).toBe(0);
  });

  it("starts paused with arrows, no dots, under reduced motion", () => {
    installMatchMedia(true);
    const svg = renderMapInMotion(potential);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(arrowCount(svg)).toBeGreaterThan(0);
  });

  it("drops the dots when the system switches to reduced motion", () => {
    const media = installMatchMedia(false);
    const svg = renderMapInMotion(potential);
    expect(svg.querySelectorAll("animateMotion").length).toBeGreaterThan(0);

    act(() => media.setReduced(true));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(arrowCount(svg)).toBeGreaterThan(0);
  });

  it("keeps labels visible while paused", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const svg = renderMapInMotion(potential);
    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(svg.querySelectorAll('rect[class*="labelPill"]').length).toBeGreaterThan(0);
    expect(svg.textContent).toContain(romaniaGraph.cities[3].name);
  });

  it("leaves a zero-current edge with neither dots nor an arrow", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    // Everything sits at 100 except Zerind, so Arad-Zerind flows while the
    // equal-potential Oradea-Sibiu road stays dead.
    const flat: Record<number, number> = Object.fromEntries(
      romaniaGraph.cities.map((city) => [city.id, city.id === 1 ? 90 : 100]),
    );
    const svg = renderMapInMotion(flat);

    // Playing: the live edge has dots, the dead edge has none.
    expect(edgeMotion(svg, "0-1").dots).toBeGreaterThan(0);
    expect(edgeMotion(svg, "2-3").dots).toBe(0);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));

    // Paused: the live edge swaps to an arrow, the dead edge still has neither.
    expect(edgeMotion(svg, "0-1").dots).toBe(0);
    expect(edgeMotion(svg, "0-1").arrows).toBeGreaterThan(0);
    expect(edgeMotion(svg, "2-3").dots).toBe(0);
    expect(edgeMotion(svg, "2-3").arrows).toBe(0);
  });
});
