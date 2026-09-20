// lib/circuitLabelLayout.test.ts
import { describe, expect, it } from "vitest";

import {
  DEPARTURE_MONO,
  layoutLabels,
  pillSize,
  textBaselineOffset,
  type Circle,
  type LabelSpec,
  type Rect,
} from "./circuitLabelLayout";

const BOUNDS: Rect = { x: 120, y: 50, w: 900, h: 650 };

function spec(overrides: Partial<LabelSpec> & Pick<LabelSpec, "id" | "text">): LabelSpec {
  return {
    fontSize: 14,
    anchor: { x: 500, y: 400 },
    direction: { x: 0, y: -1 },
    gap: 30,
    ...overrides,
  };
}

function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

function inside(rect: Rect, bounds: Rect): boolean {
  return (
    rect.x >= bounds.x - 1e-6 &&
    rect.y >= bounds.y - 1e-6 &&
    rect.x + rect.w <= bounds.x + bounds.w + 1e-6 &&
    rect.y + rect.h <= bounds.y + bounds.h + 1e-6
  );
}

describe("pillSize", () => {
  it("uses Departure Mono's real advance width and a 0.9em horizontal padding", () => {
    const { w, h } = pillSize("ABCDE", 10);
    expect(DEPARTURE_MONO.advance).toBeCloseTo(350 / 550, 10);
    expect(w).toBeCloseTo(5 * (350 / 550) * 10 + 9, 6);
    expect(h).toBeCloseTo(17, 6);
  });

  it("scales width linearly with the character count", () => {
    const one = pillSize("A", 12).w;
    const five = pillSize("AAAAA", 12).w;
    expect(five - one).toBeCloseTo(4 * DEPARTURE_MONO.advance * 12, 6);
  });
});

describe("layoutLabels", () => {
  it("centres text horizontally and on the cap-height box vertically", () => {
    const [placed] = layoutLabels([spec({ id: "a", text: "Sibiu" })], [], BOUNDS);
    const capHeight = DEPARTURE_MONO.capHeight * 14;
    expect(placed.baselineY).toBeCloseTo(placed.center.y + textBaselineOffset(14), 6);
    // Cap top and bottom are symmetric about the pill centre.
    const capTop = placed.baselineY - capHeight;
    const capBottom = placed.baselineY;
    expect((capTop + capBottom) / 2).toBeCloseTo(placed.center.y, 6);
    expect(placed.textX).toBeCloseTo(placed.center.x, 6);
    // The pill actually encloses the cap-height text.
    expect(placed.rect.y).toBeLessThanOrEqual(capTop);
    expect(placed.rect.y + placed.rect.h).toBeGreaterThanOrEqual(capBottom);
    // A label that keeps its preferred spot needs no leader.
    expect(placed.leader).toBeNull();
  });

  it("clamps a label into the viewBox instead of letting it clip", () => {
    const [placed] = layoutLabels(
      [
        spec({
          id: "top",
          text: "Oradea",
          anchor: { x: 500, y: 55 },
          direction: { x: 0, y: -1 },
          gap: 40,
          anchorRadius: 16,
        }),
      ],
      [{ x: 500, y: 55, r: 16 }],
      BOUNDS,
    );
    expect(inside(placed.rect, BOUNDS)).toBe(true);
    // It could not stay above the node, so it points back with a leader.
    expect(placed.leader).not.toBeNull();
  });

  it("moves a colliding label aside, keeps both pills apart, and draws a leader", () => {
    const first = spec({ id: "a", text: "Arad" });
    const second = spec({ id: "b", text: "Zerind" });
    const placed = layoutLabels([first, second], [], BOUNDS);

    expect(overlaps(placed[0].rect, placed[1].rect)).toBe(false);
    expect(placed[0].leader).toBeNull();
    expect(placed[1].leader).not.toBeNull();
  });

  it("avoids node circles", () => {
    const nodes: Circle[] = [{ x: 500, y: 400, r: 16 }];
    const placed = layoutLabels(
      [spec({ id: "a", text: "Arad", gap: 4 })],
      nodes,
      BOUNDS,
    );
    // The pill must not sit on top of the node it points at.
    const rect = placed[0].rect;
    const nearestX = Math.min(Math.max(nodes[0].x, rect.x), rect.x + rect.w);
    const nearestY = Math.min(Math.max(nodes[0].y, rect.y), rect.y + rect.h);
    expect(Math.hypot(nodes[0].x - nearestX, nodes[0].y - nearestY)).toBeGreaterThanOrEqual(
      nodes[0].r,
    );
  });

  it("places a dense, real-geometry cluster without any label overlap or clipping", () => {
    // Real coordinates from romaniaGraph for a crowded corner of the map.
    const specs: LabelSpec[] = [
      spec({ id: "n0", text: "Arad", anchor: { x: 233.4, y: 347.4 }, gap: 38 }),
      spec({ id: "v0", text: "12.3V", anchor: { x: 233.4, y: 347.4 }, direction: { x: 0, y: 1 }, gap: 56 }),
      spec({ id: "n1", text: "Zerind", anchor: { x: 252.3, y: 290.2 }, gap: 34 }),
      spec({ id: "v1", text: "10.1V", anchor: { x: 252.3, y: 290.2 }, direction: { x: 0, y: 1 }, gap: 52 }),
      spec({ id: "n2", text: "Oradea", anchor: { x: 289.2, y: 234.6 }, gap: 34 }),
      spec({ id: "v2", text: "8.4V", anchor: { x: 289.2, y: 234.6 }, direction: { x: 0, y: 1 }, gap: 52 }),
      spec({ id: "n4", text: "Timisoara", anchor: { x: 223.9, y: 404.8 }, gap: 38 }),
      spec({ id: "v4", text: "5.0V", anchor: { x: 223.9, y: 404.8 }, direction: { x: 0, y: 1 }, gap: 56 }),
      spec({ id: "n5", text: "Lugoj", anchor: { x: 287.7, y: 412.4 }, gap: 34 }),
      spec({ id: "v5", text: "3.2V", anchor: { x: 287.7, y: 412.4 }, direction: { x: 0, y: 1 }, gap: 52 }),
      spec({ id: "e0-1", text: "75Ω · 0.421A", anchor: { x: 242.9, y: 318.8 }, direction: { x: 0.2, y: -0.98 }, gap: 70 }),
      spec({ id: "e0-4", text: "118Ω · 0.155A", anchor: { x: 228.7, y: 376.1 }, direction: { x: 0.99, y: 0.05 }, gap: 70 }),
    ];
    const nodes: Circle[] = [
      { x: 233.4, y: 347.4, r: 16 },
      { x: 252.3, y: 290.2, r: 12 },
      { x: 289.2, y: 234.6, r: 12 },
      { x: 223.9, y: 404.8, r: 12 },
      { x: 287.7, y: 412.4, r: 12 },
    ];

    const placed = layoutLabels(specs, nodes, BOUNDS);

    expect(placed).toHaveLength(specs.length);
    for (let i = 0; i < placed.length; i++) {
      expect(inside(placed[i].rect, BOUNDS), `${specs[i].id} clips`).toBe(true);
      for (let j = i + 1; j < placed.length; j++) {
        expect(
          overlaps(placed[i].rect, placed[j].rect, 1),
          `${specs[i].id} overlaps ${specs[j].id}`,
        ).toBe(false);
      }
      for (const node of nodes) {
        const rect = placed[i].rect;
        const nearestX = Math.min(Math.max(node.x, rect.x), rect.x + rect.w);
        const nearestY = Math.min(Math.max(node.y, rect.y), rect.y + rect.h);
        expect(
          Math.hypot(node.x - nearestX, node.y - nearestY),
          `${specs[i].id} overlaps a node`,
        ).toBeGreaterThanOrEqual(node.r - 1e-6);
      }
    }
  });

  it("is deterministic: identical input gives identical output", () => {
    const specs = [
      spec({ id: "a", text: "Arad" }),
      spec({ id: "b", text: "Zerind", anchor: { x: 501, y: 399 } }),
      spec({ id: "c", text: "Oradea", anchor: { x: 520, y: 410 } }),
    ];
    expect(layoutLabels(specs, [], BOUNDS)).toEqual(layoutLabels(specs, [], BOUNDS));
  });
});
