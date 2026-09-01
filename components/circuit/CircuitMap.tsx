// components/circuit/CircuitMap.tsx
"use client";

import { countyOutlines } from "../../lib/countyOutlines";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { getRoadPathD, getRoadPoints, polylineMidpoint } from "../../lib/roadPath";
import type { ConductanceEdge } from "../../lib/types";
import styles from "./CircuitMap.module.css";

export type CircuitMarkerRole = "focus" | "chosen" | "considered" | "path" | "goal";

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

// Reference width used when the map component was originally tuned --
// offsets scale relative to this so a tightly-cropped, zoomed-in viewBox
// (small width) gets proportionally larger offsets in map-units, keeping
// label spacing visually constant on screen regardless of zoom level.
const REFERENCE_VIEWBOX_WIDTH = 900;

function parseViewBoxWidth(viewBox: string): number {
  const parts = viewBox.trim().split(/\s+/).map(Number);
  const width = parts[2];
  return Number.isFinite(width) && width > 0 ? width : REFERENCE_VIEWBOX_WIDTH;
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

/** Rough monospace/sans char-width estimate in map-units, for pill sizing. */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.62;
}

function LabelPill({
  x,
  y,
  text,
  fontSize,
  className,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  className: string;
}) {
  const w = estimateTextWidth(text, fontSize) + fontSize * 0.9;
  const h = fontSize * 1.7;
  return (
    <>
      <rect
        x={x - w / 2}
        y={y - h * 0.72}
        width={w}
        height={h}
        rx={h / 2.4}
        className={styles.labelPill}
      />
      <text x={x} y={y} textAnchor="middle" className={className} style={{ fontSize }}>
        {text}
      </text>
    </>
  );
}

/**
 * Renders the Romania road graph as a solved electrical circuit. Every road
 * is a resistor (R = distance in km), every city a node colored by its
 * solved voltage, and current dots physically travel along each edge's real
 * road geometry -- direction and speed derived from I = G(Vi - Vj).
 *
 * All label offsets scale with the viewBox width so spacing stays legible
 * whether this renders the full 20-city map or a tight per-node crop. Each
 * offset also carries a floor (via Math.max) so tightly-cropped views don't
 * shrink the gaps enough for neighboring labels to collide.
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
  const scale = parseViewBoxWidth(viewBox) / REFERENCE_VIEWBOX_WIDTH;
  const nodeNameGap = Math.max(15 * scale, 13);
  const nodeVoltageGap = Math.max(30 * scale, 26);
  const edgeLabelGap = Math.max(46 * scale, 40);
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
    return { ...edge, fromCity, toCity, current, tier, key };
  });

  const maxCurrent = Math.max(...resolved.map((e) => e.current), 1e-6);
  const maxPotential = Math.max(...Object.values(potential), 1e-6);

  const tierRank: Record<EdgeTier, number> = { faint: 0, considered: 1, hot: 2 };
  const drawOrder = [...resolved].sort((a, b) => tierRank[a.tier] - tierRank[b.tier]);

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

      {drawOrder.map((edge) => {
        const pathId = `circuit-edge-${edge.city_a}-${edge.city_b}-${edge.tier}`;
        const d = getRoadPathD(edge.fromCity, edge.toCity, 0);
        const showDetail = edge.tier !== "faint";
        const dotCount = edge.tier === "hot" ? 4 : edge.tier === "considered" ? 2 : 1;
        const ratio = edge.current / maxCurrent;
        const dotDuration = Math.max(1.1, Math.min(6, 6 - ratio * 4.8));

        let resistorD: string | null = null;
        let labelX = 0;
        let labelY = 0;
        let labelText = "";
        if (showDetail) {
          const points = getRoadPoints(edge.fromCity, edge.toCity);
          const mid = polylineMidpoint(points);
          const tx = mid.ny;
          const ty = -mid.nx;
          resistorD = buildResistorSymbol(mid.x, mid.y, tx, ty, mid.nx, mid.ny, resistorLength, resistorAmplitude);
          labelX = mid.x + mid.nx * edgeLabelGap;
          labelY = mid.y + mid.ny * edgeLabelGap;
          labelText = `${edge.distance}Ω · ${edge.current.toFixed(3)}A`;
        }

        return (
          <g key={edge.key + edge.tier} className={[styles.edge, styles[`edge_${edge.tier}`]].join(" ")}>
            <path id={pathId} className={styles.wireLine} d={d} />
            {resistorD && <path className={styles.resistorSymbol} d={resistorD} />}
            {showDetail && (
              <LabelPill
                x={labelX}
                y={labelY}
                text={labelText}
                fontSize={edgeFontSize}
                className={styles.edgeLabel}
              />
            )}

            {Array.from({ length: dotCount }).map((_, dotIndex) => (
              <circle
                key={dotIndex}
                r={(edge.tier === "hot" ? 3.2 : edge.tier === "considered" ? 2.4 : 1.6) * Math.max(scale, 0.5)}
                className={styles.currentDot}
              >
                <animateMotion
                  dur={`${dotDuration}s`}
                  begin={`${(dotIndex / dotCount) * dotDuration}s`}
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

      {markers.map((marker) => {
        const city = romaniaGraph.cities[marker.cityId];
        if (!city) return null;
        const isGoal = marker.role === "goal";
        const v = isGoal ? 0 : potential[marker.cityId] ?? 0;
        const t = Math.max(0, Math.min(1, v / maxPotential));
        const size = NODE_SIZE[marker.role] * Math.max(scale, 0.55);

        return (
          <g key={marker.cityId} className={[styles.node, styles[`node_${marker.role}`]].join(" ")}>
            <circle
              cx={city.x}
              cy={city.y}
              r={size}
              className={styles.nodeCircle}
              style={{ "--v-t": t } as React.CSSProperties}
            />
            <LabelPill
              x={city.x}
              y={city.y - size - nodeNameGap}
              text={city.name}
              fontSize={nodeFontSize}
              className={styles.nodeLabel}
            />
            <LabelPill
              x={city.x}
              y={city.y + size + nodeVoltageGap}
              text={isGoal ? "GND · 0V" : `${v.toFixed(1)}V`}
              fontSize={voltageFontSize}
              className={styles.nodeVoltage}
            />
          </g>
        );
      })}
    </svg>
  );
}