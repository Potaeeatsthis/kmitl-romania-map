// lib/circuitLabelLayout.ts
//
// Deterministic SVG label placement for CircuitMap. Pure geometry, no React.
//
// Pills are sized from the real Departure Mono metrics (unitsPerEm 550,
// advance width 350, cap height 400) so a pill always encloses its text, and
// each text baseline is placed so the cap-height box is vertically centred in
// the pill. Relying on `dominant-baseline: middle` left the text sitting low
// in the pill because the SVG `middle` value centres on the x-height, not the
// cap height the labels actually use.
//
// Placement walks each label through candidate anchors (preferred direction
// first, then pushed further out and fanned sideways) and keeps the first
// candidate that collides with neither an already-placed pill nor a node
// circle and stays inside the viewBox. If every candidate collides it keeps
// the one with the least overlap, so a label is always drawn. A leader line is
// emitted only when the label had to leave its preferred spot.

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Circle = { x: number; y: number; r: number };

export const DEPARTURE_MONO = {
  /** Advance width of every glyph, in em. */
  advance: 350 / 550,
  /** Cap height, in em. */
  capHeight: 400 / 550,
} as const;

/** Pill box for a string at a given font size, using Departure Mono metrics. */
export function pillSize(text: string, fontSize: number): { w: number; h: number } {
  return {
    w: text.length * DEPARTURE_MONO.advance * fontSize + fontSize * 0.9,
    h: fontSize * 1.7,
  };
}

/**
 * Baseline offset below a pill's vertical centre. Centring the cap-height box
 * means the baseline sits half a cap height under the centre.
 */
export function textBaselineOffset(fontSize: number): number {
  return (DEPARTURE_MONO.capHeight * fontSize) / 2;
}

export type LabelSpec = {
  id: string;
  text: string;
  fontSize: number;
  /** Point the label belongs to (city centre or road midpoint). */
  anchor: Point;
  /** Unit vector pointing to the preferred side of the anchor. */
  direction: Point;
  /** Preferred distance from the anchor to the pill's near edge. */
  gap: number;
  /** Node radius, so a leader starts at the circle edge instead of its centre. */
  anchorRadius?: number;
};

export type PlacedLabel = {
  id: string;
  text: string;
  fontSize: number;
  center: Point;
  rect: Rect;
  textX: number;
  baselineY: number;
  leader: { x1: number; y1: number; x2: number; y2: number } | null;
};

export type LayoutOptions = {
  /** Keep-out band inside the viewBox edges. */
  margin?: number;
  /** Required gap between two pills. */
  labelPadding?: number;
  /** Required gap between a pill and a node circle. */
  nodePadding?: number;
};

// Preferred direction first, then progressively fanned out to either side.
// For each direction we first push straight out, then further out.
const ANGLE_OFFSETS_DEG = [0, -30, 30, -60, 60, -90, 90, -120, 120, -150, 150, 180];
const RADIUS_STEPS = [0, 1, 2, 3];

// A label is "displaced" once it has moved more than this far (map units) from
// where it wanted to be; only then is a leader line worth drawing.
const DISPLACEMENT_EPSILON = 0.5;

function normalize(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  if (len === 0) return { x: 0, y: -1 };
  return { x: p.x / len, y: p.y / len };
}

function rotate(p: Point, radians: number): Point {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function clampCenter(center: Point, w: number, h: number, bounds: Rect, margin: number): Point {
  const minX = bounds.x + margin + w / 2;
  const maxX = bounds.x + bounds.w - margin - w / 2;
  const minY = bounds.y + margin + h / 2;
  const maxY = bounds.y + bounds.h - margin - h / 2;
  return {
    x: minX <= maxX ? clamp(center.x, minX, maxX) : bounds.x + bounds.w / 2,
    y: minY <= maxY ? clamp(center.y, minY, maxY) : bounds.y + bounds.h / 2,
  };
}

/**
 * Collision cost of a candidate pill: 0 means it fits. Overlap area with other
 * pills plus a squared node penetration keeps the fallback pick sensible when
 * the map is genuinely too crowded for a clean spot.
 */
function candidatePenalty(
  rect: Rect,
  placedRects: Rect[],
  nodes: Circle[],
  labelPadding: number,
  nodePadding: number,
): number {
  let penalty = 0;
  for (const other of placedRects) {
    penalty += overlapArea(rect, {
      x: other.x - labelPadding,
      y: other.y - labelPadding,
      w: other.w + labelPadding * 2,
      h: other.h + labelPadding * 2,
    });
  }
  for (const node of nodes) {
    const nearestX = clamp(node.x, rect.x, rect.x + rect.w);
    const nearestY = clamp(node.y, rect.y, rect.y + rect.h);
    const distance = Math.hypot(node.x - nearestX, node.y - nearestY);
    const radius = node.r + nodePadding;
    if (distance < radius) penalty += (radius - distance) ** 2 * 100;
  }
  return penalty;
}

/**
 * Places every label in the order given (earlier = higher priority), returning
 * one placement per spec, in the same order.
 */
export function layoutLabels(
  specs: LabelSpec[],
  nodes: Circle[],
  bounds: Rect,
  options: LayoutOptions = {},
): PlacedLabel[] {
  const margin = options.margin ?? 3;
  const labelPadding = options.labelPadding ?? 2;
  const nodePadding = options.nodePadding ?? 2;

  const placed: PlacedLabel[] = [];
  const placedRects: Rect[] = [];

  for (const spec of specs) {
    const { w, h } = pillSize(spec.text, spec.fontSize);
    const direction = normalize(spec.direction);
    const preferredDistance = spec.gap + h / 2;
    const preferredCenter = {
      x: spec.anchor.x + direction.x * preferredDistance,
      y: spec.anchor.y + direction.y * preferredDistance,
    };
    const step = h + spec.fontSize * 0.4;

    let bestCenter = clampCenter(preferredCenter, w, h, bounds, margin);
    let bestPenalty = Number.POSITIVE_INFINITY;

    // ponytail: greedy over a finite candidate set -- if every candidate
    // collides, the least-overlap fallback can still touch under extreme
    // crowding. Upgrade to broader/global placement only if real maps fail.
    outer: for (const angle of ANGLE_OFFSETS_DEG) {
      const rotated = rotate(direction, (angle * Math.PI) / 180);
      for (const radiusStep of RADIUS_STEPS) {
        const distance = preferredDistance + radiusStep * step;
        const rawCenter = {
          x: spec.anchor.x + rotated.x * distance,
          y: spec.anchor.y + rotated.y * distance,
        };
        const center = clampCenter(rawCenter, w, h, bounds, margin);
        const rect = { x: center.x - w / 2, y: center.y - h / 2, w, h };
        const penalty = candidatePenalty(rect, placedRects, nodes, labelPadding, nodePadding);
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestCenter = center;
        }
        if (penalty === 0) break outer;
      }
    }

    const rect = { x: bestCenter.x - w / 2, y: bestCenter.y - h / 2, w, h };
    const displaced =
      Math.hypot(bestCenter.x - preferredCenter.x, bestCenter.y - preferredCenter.y) >
      DISPLACEMENT_EPSILON;

    let leader: PlacedLabel["leader"] = null;
    if (displaced) {
      const targetX = clamp(spec.anchor.x, rect.x, rect.x + rect.w);
      const targetY = clamp(spec.anchor.y, rect.y, rect.y + rect.h);
      const inside = targetX === spec.anchor.x && targetY === spec.anchor.y;
      if (!inside) {
        const toTarget = normalize({ x: targetX - spec.anchor.x, y: targetY - spec.anchor.y });
        const startRadius = spec.anchorRadius ?? 0;
        leader = {
          x1: spec.anchor.x + toTarget.x * startRadius,
          y1: spec.anchor.y + toTarget.y * startRadius,
          x2: targetX,
          y2: targetY,
        };
      }
    }

    placed.push({
      id: spec.id,
      text: spec.text,
      fontSize: spec.fontSize,
      center: bestCenter,
      rect,
      textX: bestCenter.x,
      baselineY: bestCenter.y + textBaselineOffset(spec.fontSize),
      leader,
    });
    placedRects.push(rect);
  }

  return placed;
}
