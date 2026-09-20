// components/circuit/CircuitMap.tsx
"use client";

import { countyOutlines } from "../../lib/countyOutlines";
import { layoutLabels, type Circle, type LabelSpec, type PlacedLabel } from "../../lib/circuitLabelLayout";
import { carriesCurrent } from "../../lib/kirchhoff";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { getRoadPathD, getRoadPoints, polylineMidpoint } from "../../lib/roadPath";
import type { ConductanceEdge } from "../../lib/types";
import CircuitNode, { type CircuitMarkerRole } from "./CircuitNode";
import { useCircuitMotion } from "./CircuitMotion";
import styles from "./CircuitMap.module.css";

export type { CircuitMarkerRole } from "./CircuitNode";

export type CircuitMarker = {
  cityId: number;
  role: CircuitMarkerRole;
};

type EdgeTier = "hot" | "considered" | "faint";

const NODE_SIZE: Record<CircuitMarkerRole, number> = {
  focus: 16,
  goal: 16,
  chosen: 13,
  considered: 12,
  path: 10,
};

const ROLE_RANK: Record<CircuitMarkerRole, number> = {
  focus: 0,
  goal: 0,
  chosen: 1,
  considered: 2,
  path: 3,
};

// Reference width used when the map component was originally tuned --
// offsets scale relative to this so a tightly-cropped, zoomed-in viewBox
// (small width) gets proportionally larger offsets in map-units, keeping
// label spacing visually constant on screen regardless of zoom level.
const REFERENCE_VIEWBOX_WIDTH = 900;
const FALLBACK_VIEWBOX = { x: 120, y: 50, w: 900, h: 650 };

function parseViewBox(viewBox: string): { x: number; y: number; w: number; h: number } {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const [x, y, w, h] = parts;
  if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) return { x, y, w, h };
  return FALLBACK_VIEWBOX;
}

function edgeKey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}

function buildResistorSymbol(
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  nx: number,
  ny: number,
  length: number,
  amplitude: number,
): string {
  const tPositions = [-0.5, -0.33, -0.17, 0, 0.17, 0.33, 0.5].map((t) => t * length);
  const ampPattern = [0, 1, -1, 1, -1, 1, 0];
  const points = tPositions.map((t, i) => ({
    x: cx + tx * t + nx * ampPattern[i] * amplitude,
    y: cy + ty * t + ny * ampPattern[i] * amplitude,
  }));
  const [first, ...rest] = points;
  let d = `M ${first.x.toFixed(2)},${first.y.toFixed(2)}`;
  for (const p of rest) d += ` L ${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  return d;
}

/**
 * Short roads (common once a crop zooms in tight, or between neighboring
 * cities like Arad-Zerind) put the road's midpoint very close to the city
 * node itself -- pushing the edge label out by a fixed gap isn't enough,
 * because the node's own name/voltage labels are sitting right there too.
 * This scales the push further out the shorter the road is on screen.
 */
function adaptiveEdgeGap(points: { x: number; y: number }[], baseGap: number): number {
  if (points.length < 2) return baseGap;
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const shortRoadThreshold = 130;
  if (length >= shortRoadThreshold) return baseGap;
  const boost = Math.min(3, shortRoadThreshold / Math.max(length, 20));
  return baseGap * boost;
}

function polylineLength(points: { x: number; y: number }[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return length;
}

/**
 * A filled arrowhead sitting on the road `tipOffset` past its midpoint and
 * pointing the way current travels (from -> to). This is the static stand-in
 * for the moving dots when motion is paused: the dots stop, the direction
 * does not.
 */
function buildFlowArrowPath(
  points: { x: number; y: number }[],
  tipOffset: number,
  size: number,
): string | null {
  if (points.length < 2) return null;
  const mid = polylineMidpoint(points);
  // Tangent is the road's travel direction; mid.nx/ny is its normal.
  const tx = mid.ny;
  const ty = -mid.nx;
  const tipX = mid.x + tx * tipOffset;
  const tipY = mid.y + ty * tipOffset;
  const baseX = tipX - tx * size;
  const baseY = tipY - ty * size;
  const half = size * 0.62;
  const leftX = baseX + mid.nx * half;
  const leftY = baseY + mid.ny * half;
  const rightX = baseX - mid.nx * half;
  const rightY = baseY - mid.ny * half;
  return `M ${tipX.toFixed(2)},${tipY.toFixed(2)} L ${leftX.toFixed(2)},${leftY.toFixed(2)} L ${rightX.toFixed(2)},${rightY.toFixed(2)} Z`;
}

function LabelPill({ placed, className }: { placed: PlacedLabel; className: string }) {
  return (
    <>
      <rect
        x={placed.rect.x}
        y={placed.rect.y}
        width={placed.rect.w}
        height={placed.rect.h}
        rx={placed.rect.h / 2.4}
        className={styles.labelPill}
      />
      <text
        x={placed.textX}
        y={placed.baselineY}
        textAnchor="middle"
        className={className}
        style={{ fontSize: placed.fontSize }}
      >
        {placed.text}
      </text>
    </>
  );
}

type LabelMeta =
  | { kind: "edge"; tier: EdgeTier }
  | { kind: "nodeName" | "nodeVoltage"; role: CircuitMarkerRole };

/**
 * Renders the Romania road graph as a solved electrical circuit. Every road
 * is a resistor (R = distance in km), every city a node colored by its
 * solved voltage, and current dots physically travel along each edge's real
 * road geometry -- direction and speed derived from I = G(Vi - Vj). An edge
 * with no current (equal endpoint potential, or solver roundoff) keeps its
 * wire but draws no dots, so a dead road never looks like it is carrying
 * flow.
 *
 * Label placement is delegated to lib/circuitLabelLayout: every pill is sized
 * from Departure Mono's real metrics, its text is centred on the cap-height
 * box, and pills are pushed away from each other, from node circles, and from
 * the viewBox edges (with a short leader line when a label had to move).
 */
export default function CircuitMap({
  viewBox,
  edges,
  potential,
  markers,
  hotEdges = new Set(),
  consideredEdges = new Set(),
}: {
  viewBox: string;
  edges: ConductanceEdge[];
  potential: Record<number, number>;
  markers: CircuitMarker[];
  hotEdges?: Set<string>;
  consideredEdges?: Set<string>;
}) {
  const { playing } = useCircuitMotion();
  const bounds = parseViewBox(viewBox);
  const scale = bounds.w / REFERENCE_VIEWBOX_WIDTH;
  const nodeNameGap = Math.max(15 * scale, 22);
  const nodeVoltageGap = Math.max(30 * scale, 40);
  const edgeLabelGap = Math.max(46 * scale, 70);
  const resistorLength = 24 * scale;
  const resistorAmplitude = 6 * scale;
  const nodeFontSize = Math.max(11, 14 * scale);
  const voltageFontSize = Math.max(10, 13 * scale);
  const edgeFontSize = Math.max(10, 13 * scale);

  const resolved = edges.map((edge) => {
    const va = potential[edge.city_a] ?? 0;
    const vb = potential[edge.city_b] ?? 0;
    const fromCity = va >= vb ? edge.city_a : edge.city_b;
    const toCity = va >= vb ? edge.city_b : edge.city_a;
    const current = edge.conductance * Math.abs(va - vb);
    const key = edgeKey(edge.city_a, edge.city_b);
    const tier: EdgeTier = hotEdges.has(key) ? "hot" : consideredEdges.has(key) ? "considered" : "faint";
    // Zero current (equal potential, or roundoff) must not animate: the wire
    // and its resistor symbol stay, but no dot travels along it.
    return { ...edge, fromCity, toCity, current, hasFlow: carriesCurrent(current), tier, key };
  });

  const maxCurrent = Math.max(...resolved.map((e) => e.current), 1e-6);
  const maxPotential = Math.max(...Object.values(potential), 1e-6);

  const tierRank: Record<EdgeTier, number> = { faint: 0, considered: 1, hot: 2 };
  const drawOrder = [...resolved].sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);

  const edgeRenders = drawOrder.map((edge) => {
    const pathId = `circuit-edge-${edge.city_a}-${edge.city_b}-${edge.tier}`;
    const d = getRoadPathD(edge.fromCity, edge.toCity, 0);
    const showDetail = edge.tier !== "faint";
    const dotCount = edge.tier === "hot" ? 4 : edge.tier === "considered" ? 2 : 1;
    const ratio = edge.current / maxCurrent;
    const dotDuration = Math.max(1.1, Math.min(6, 6 - ratio * 4.8));

    let resistorD: string | null = null;
    let labelSpec: LabelSpec | null = null;
    let arrowD: string | null = null;
    const points = showDetail || (!playing && edge.hasFlow) ? getRoadPoints(edge.fromCity, edge.toCity) : [];
    if (showDetail) {
      const mid = polylineMidpoint(points);
      const tx = mid.ny;
      const ty = -mid.nx;
      resistorD = buildResistorSymbol(
        mid.x,
        mid.y,
        tx,
        ty,
        mid.nx,
        mid.ny,
        resistorLength,
        resistorAmplitude,
      );
      labelSpec = {
        id: `edge-label-${edge.key}`,
        text: `${edge.distance}Ω · ${edge.current.toFixed(3)}A`,
        fontSize: edgeFontSize,
        anchor: { x: mid.x, y: mid.y },
        direction: { x: mid.nx, y: mid.ny },
        gap: adaptiveEdgeGap(points, edgeLabelGap),
      };
    }
    // Paused / reduced motion: keep the direction readable with a static
    // arrowhead, pushed just past the resistor so the two don't overlap.
    if (!playing && edge.hasFlow) {
      const arrowSize = Math.max(7, 9 * scale);
      const pastResistor = showDetail ? resistorLength / 2 + arrowSize + 4 * scale : 0;
      arrowD = buildFlowArrowPath(points, Math.min(pastResistor, polylineLength(points) * 0.35), arrowSize);
    }

    return { edge, pathId, d, dotCount, dotDuration, resistorD, labelSpec, arrowD };
  });

  // Higher-priority nodes are placed first so their labels keep their
  // preferred spot; edge labels yield to node labels. Sorting makes the
  // placement order independent of how the caller happened to order markers.
  const orderedMarkers = [...markers].sort(
    (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.cityId - b.cityId,
  );

  const nodeCircles: Circle[] = [];
  const labelRequests: { spec: LabelSpec; meta: LabelMeta }[] = [];

  for (const marker of orderedMarkers) {
    const city = romaniaGraph.cities[marker.cityId];
    if (!city) continue;
    const isGoal = marker.role === "goal";
    const v = isGoal ? 0 : potential[marker.cityId] ?? 0;
    const size = NODE_SIZE[marker.role] * Math.max(scale, 0.55);
    nodeCircles.push({ x: city.x, y: city.y, r: size });
    labelRequests.push({
      spec: {
        id: `node-name-${marker.cityId}`,
        text: city.name,
        fontSize: nodeFontSize,
        anchor: { x: city.x, y: city.y },
        direction: { x: 0, y: -1 },
        gap: size + nodeNameGap,
        anchorRadius: size,
      },
      meta: { kind: "nodeName", role: marker.role },
    });
    labelRequests.push({
      spec: {
        id: `node-voltage-${marker.cityId}`,
        text: isGoal ? "GND · 0V" : `${v.toFixed(1)}V`,
        fontSize: voltageFontSize,
        anchor: { x: city.x, y: city.y },
        direction: { x: 0, y: 1 },
        gap: size + nodeVoltageGap,
        anchorRadius: size,
      },
      meta: { kind: "nodeVoltage", role: marker.role },
    });
  }

  for (const render of edgeRenders) {
    if (render.labelSpec) {
      labelRequests.push({
        spec: render.labelSpec,
        meta: { kind: "edge", tier: render.edge.tier },
      });
    }
  }

  const placements = layoutLabels(
    labelRequests.map((request) => request.spec),
    nodeCircles,
    bounds,
  );

  const labelViews = labelRequests.map((request, index) => ({
    ...request,
    placed: placements[index],
  }));

  return (
    <svg
      viewBox={viewBox}
      className={styles.svg}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Romania road network rendered as a solved electrical circuit"
    >
      <g className={styles.countyLines} aria-hidden="true">
        {countyOutlines.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>
      <g className={styles.countryOutline} aria-hidden="true">
        {countyOutlines.map((path, index) => (
          <path key={index} d={path} />
        ))}
      </g>

      {edgeRenders.map((render) => {
        const { edge, pathId } = render;
        return (
          <g key={edge.key + edge.tier} className={[styles.edge, styles[`edge_${edge.tier}`]].join(" ")}>
            <path id={pathId} className={styles.wireLine} d={render.d} />
            {render.resistorD && <path className={styles.resistorSymbol} d={render.resistorD} />}
            {render.arrowD && <path className={styles.flowArrow} d={render.arrowD} />}

            {playing &&
              edge.hasFlow &&
              Array.from({ length: render.dotCount }).map((_, dotIndex) => (
                <circle
                  key={dotIndex}
                  r={(edge.tier === "hot" ? 3.2 : edge.tier === "considered" ? 2.4 : 1.6) * Math.max(scale, 0.5)}
                  className={styles.currentDot}
                >
                  <animateMotion
                    dur={`${render.dotDuration}s`}
                    begin={`${(dotIndex / render.dotCount) * render.dotDuration}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  >
                    <mpath href={`#${pathId}`} />
                  </animateMotion>
                </circle>
              ))}
          </g>
        );
      })}

      {orderedMarkers.map((marker) => {
        const city = romaniaGraph.cities[marker.cityId];
        if (!city) return null;
        const size = NODE_SIZE[marker.role] * Math.max(scale, 0.55);
        const isGoal = marker.role === "goal";
        const v = isGoal ? 0 : potential[marker.cityId] ?? 0;
        const t = Math.max(0, Math.min(1, v / maxPotential));
        return (
          <CircuitNode
            key={marker.cityId}
            x={city.x}
            y={city.y}
            r={size}
            role={marker.role}
            voltageT={t}
          />
        );
      })}

      {/* Leader lines first so pills sit on top of them. */}
      <g aria-hidden="true">
        {labelViews.map(({ placed }) =>
          placed.leader ? (
            <line
              key={`leader-${placed.id}`}
              x1={placed.leader.x1}
              y1={placed.leader.y1}
              x2={placed.leader.x2}
              y2={placed.leader.y2}
              className={styles.leaderLine}
            />
          ) : null,
        )}
      </g>

      {/* Every label after the wires and nodes, so no pill is buried. */}
      <g>
        {labelViews.map(({ placed, meta }) => {
          const className =
            meta.kind === "edge"
              ? [styles.edgeLabel, styles[`edgeLabel_${meta.tier}`]].join(" ")
              : meta.kind === "nodeName"
                ? styles.nodeLabel
                : styles.nodeVoltage;
          return <LabelPill key={placed.id} placed={placed} className={className} />;
        })}
      </g>
    </svg>
  );
}
