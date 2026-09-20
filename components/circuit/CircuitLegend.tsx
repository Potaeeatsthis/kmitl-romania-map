// components/circuit/CircuitLegend.tsx
"use client";

import CircuitNode, { type CircuitMarkerRole } from "./CircuitNode";
import styles from "./CircuitMap.module.css";

export type CircuitLegendVariant = "overview" | "terminal";

type OutlineSample = {
  role: CircuitMarkerRole;
  label: string;
  note: string;
};

// The terminal maps answer "what is A* doing here", so the outline group names
// the three search states a reader actually sees.
const TERMINAL_OUTLINES: OutlineSample[] = [
  { role: "focus", label: "This city", note: "being expanded now" },
  { role: "chosen", label: "Checked next", note: "lowest f = g + h" },
  { role: "considered", label: "Other waiting cities", note: "still in the queue" },
];

// The overview shows the finished route instead of an active expansion.
const OVERVIEW_OUTLINES: OutlineSample[] = [
  { role: "focus", label: "Start", note: "1 A pushed in here" },
  { role: "goal", label: "Destination (ground)", note: "0 V, current leaves here" },
  { role: "path", label: "On the final route", note: "a city A* chose" },
];

function NodeGlyph({ role }: { role: CircuitMarkerRole }) {
  return (
    <svg className={styles.legendGlyph} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <CircuitNode x={13} y={13} r={8} role={role} voltageT={0.5} neutralFill />
    </svg>
  );
}

/**
 * The circuit map's key. It is deliberately split into the two independent
 * channels a reader has to keep apart:
 *
 *  1. the circle outline -- what A* is doing (solid / dashed / dotted, not
 *     colour alone), and
 *  2. the circle fill -- the city's voltage, which has nothing to do with A*.
 *
 * Every outline sample renders through CircuitNode with the same CSS classes
 * the map uses, so a swatch cannot silently drift from the node it explains.
 */
export default function CircuitLegend({ variant }: { variant: CircuitLegendVariant }) {
  const outlines = variant === "terminal" ? TERMINAL_OUTLINES : OVERVIEW_OUTLINES;
  return (
    <div className={styles.legend} role="group" aria-label="Circuit map key">
      <section className={styles.legendGroup} aria-label="Circle outline meaning">
        <p className={styles.legendTitle}>
          {variant === "terminal" ? "Circle outline = what A* is doing" : "Circle outline = the route"}
        </p>
        <ul className={styles.legendList}>
          {outlines.map((sample) => (
            <li key={sample.role} className={styles.legendItem}>
              <NodeGlyph role={sample.role} />
              <span className={styles.legendLabel}>
                {sample.label}
                <span className={styles.legendNote}>{sample.note}</span>
              </span>
            </li>
          ))}
          {variant === "overview" && (
            <li className={styles.legendItem}>
              <svg className={styles.legendGlyph} viewBox="0 0 26 26" aria-hidden="true" focusable="false">
                <g className={styles.edge_hot}>
                  <path className={styles.wireLine} d="M3 13 H23" />
                </g>
              </svg>
              <span className={styles.legendLabel}>
                Final route
                <span className={styles.legendNote}>the path A* chose</span>
              </span>
            </li>
          )}
        </ul>
      </section>

      <section className={styles.legendGroup} aria-label="Circle color meaning">
        <p className={styles.legendTitle}>Circle color = voltage</p>
        <div className={styles.voltageScale}>
          <span>Lower voltage</span>
          <span className={styles.voltageScaleBar} aria-hidden="true" />
          <span>Higher voltage</span>
        </div>
        <p className={styles.legendFillNote}>
          The fill is each city&apos;s voltage, not what A* is doing. It does not change with A*
          status: a waiting city can be high-voltage, and the city checked next can be
          low-voltage. The destination sits at ground (0 V), so it is always the lowest color.
        </p>
      </section>
    </div>
  );
}
