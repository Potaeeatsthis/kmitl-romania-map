// components/circuit/CircuitNode.tsx
"use client";

import type { CSSProperties } from "react";

import styles from "./CircuitMap.module.css";

export type CircuitMarkerRole = "focus" | "chosen" | "considered" | "path" | "goal";

/**
 * One city circle. The map and the legend both render through this component,
 * so a legend sample can never drift from the node it explains: the role
 * outline and the voltage fill come from the same CSS classes, and the fill
 * from the same `--v-t` value.
 *
 * `neutralFill` is used only by the legend's outline group, where the fill is
 * deliberately flat so the outline -- and only the outline -- is being read.
 */
export default function CircuitNode({
  x,
  y,
  r,
  role,
  voltageT,
  neutralFill = false,
}: {
  x: number;
  y: number;
  r: number;
  role?: CircuitMarkerRole;
  voltageT: number;
  neutralFill?: boolean;
}) {
  const className = [
    styles.node,
    role ? styles[`node_${role}`] : "",
    neutralFill ? styles.nodeNeutral : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <g className={className}>
      <circle
        cx={x}
        cy={y}
        r={r}
        className={styles.nodeCircle}
        style={{ "--v-t": voltageT } as CSSProperties}
      />
    </g>
  );
}
