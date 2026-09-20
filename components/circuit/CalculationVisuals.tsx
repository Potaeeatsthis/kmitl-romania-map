// components/circuit/CalculationVisuals.tsx
"use client";

import { carriesCurrent } from "../../lib/kirchhoff";
import { useCircuitMotion } from "./CircuitMotion";
import styles from "./CalculationVisuals.module.css";

/** Horizontal bars showing each city's voltage relative to ground. */
export function VoltageBarChart({
  cities,
}: {
  cities: { cityId: number; name: string; voltage: number; isGoal?: boolean; isStart?: boolean }[];
}) {
  const max = Math.max(...cities.map((c) => c.voltage), 1e-6);
  return (
    <div className={styles.voltBars}>
      {cities.map((c) => (
        <div key={c.cityId} className={styles.voltBarRow}>
          <span className={styles.voltBarLabel}>{c.name}</span>
          <div className={styles.voltBarTrack}>
            <div
              className={[styles.voltBarFill, c.isGoal ? styles.voltBarFillGoal : ""].join(" ")}
              style={{ width: `${Math.max(2, (c.voltage / max) * 100)}%` }}
            />
          </div>
          <span className={styles.voltBarValue}>{c.isGoal ? "0V" : `${c.voltage.toFixed(1)}V`}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * A small circuit schematic: source terminal -> resistor -> destination
 * terminal. Each terminal's label is a two-line block (name, then value)
 * anchored to that terminal's own x position -- never spanning the full
 * width -- so long city names or long decimals never collide with the
 * label on the opposite end. A ground symbol is only drawn when
 * `toIsGround` is true. Small dots animate along the wire, direction and
 * speed driven by the sign and magnitude of `current`; when `current` is zero
 * (equal potential, or solver roundoff) the wire, resistor, and labels stay
 * but neither the dots nor the direction arrow are drawn.
 */
export function CircuitSchematic({
  fromLabel,
  fromVoltage,
  fromIsSource = false,
  toLabel,
  toVoltage,
  toIsGround = false,
  resistance,
  conductance,
  current,
  compact = false,
}: {
  fromLabel: string;
  fromVoltage: number;
  fromIsSource?: boolean;
  toLabel: string;
  toVoltage: number;
  toIsGround?: boolean;
  resistance: number;
  conductance: number;
  /** Signed: positive means current flows from -> to. */
  current: number;
  compact?: boolean;
}) {
  // `flowsForward` is only meaningful when there is flow at all; a zero or
  // roundoff-level current has no direction to draw.
  const { playing } = useCircuitMotion();
  const hasFlow = carriesCurrent(current);
  const flowsForward = current >= 0;
  const magnitude = Math.abs(current);
  const width = compact ? 260 : 300;
  const leftX = 10;
  const rightX = width - 75;
  const wireY = 68;
  const rightSegmentStart = compact ? leftX + 130 : leftX + 157;
  // Faster / brighter dots for higher current, clamped to a sane range.
  const duration = Math.max(0.6, Math.min(3.2, 1.6 / Math.max(magnitude, 0.05)));

  return (
    <svg
      viewBox={`0 0 ${width} 150`}
      className={[styles.schematic, compact ? styles.schematicCompact : ""].join(" ")}
      role="img"
      aria-label={
        hasFlow
          ? `Circuit from ${fromLabel} to ${toLabel}: resistance ${resistance} ohms, current ${magnitude.toFixed(3)} amps flowing ${flowsForward ? "toward" : "away from"} ${toLabel}`
          : `Circuit from ${fromLabel} to ${toLabel}: resistance ${resistance} ohms, no current flow`
      }
    >
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {/* source terminal (battery-style double bar) */}
        <line x1={leftX} y1={wireY - 15} x2={leftX} y2={wireY + 15} strokeWidth="4" />
        <line x1={leftX + 12} y1={wireY - 7} x2={leftX + 12} y2={wireY + 7} strokeWidth="2" />
        <line x1={leftX + 6} y1={wireY} x2={leftX + 42} y2={wireY} />

        {/* resistor zigzag */}
        <polyline
          points={compact
            ? `${leftX + 42},${wireY} ${leftX + 54},${wireY - 12} ${leftX + 70},${wireY + 12} ${leftX + 86},${wireY - 12} ${leftX + 102},${wireY + 12} ${leftX + 118},${wireY - 12} ${leftX + 130},${wireY}`
            : `${leftX + 42},${wireY} ${leftX + 57},${wireY - 12} ${leftX + 77},${wireY + 12} ${leftX + 97},${wireY - 12} ${leftX + 117},${wireY + 12} ${leftX + 137},${wireY - 12} ${leftX + 157},${wireY}`}
        />

        <line
          x1={compact ? leftX + 130 : leftX + 157}
          y1={wireY}
          x2={rightX}
          y2={wireY}
        />

        {/* destination terminal */}
        <line x1={rightX} y1={wireY - 12} x2={rightX} y2={wireY + 12} strokeWidth="3" />
        {toIsGround && (
          <>
            <line x1={rightX - 8} y1={wireY + 18} x2={rightX + 8} y2={wireY + 18} />
            <line x1={rightX - 5} y1={wireY + 25} x2={rightX + 5} y2={wireY + 25} />
            <line x1={rightX - 2} y1={wireY + 32} x2={rightX + 2} y2={wireY + 32} />
          </>
        )}
      </g>

      {/* flowing current dots along both straight wire segments. A zero or
          roundoff-level current has no flow to animate, so the wire stays
          still. */}
      {playing && hasFlow && (
        <g className={styles.flowDots}>
          {[0, 0.33, 0.66].map((offset) => (
            <circle key={`l-${offset}`} r={compact ? 2 : 2.4} className={styles.flowDot}>
              <animateMotion
                dur={`${duration}s`}
                begin={`${offset * duration}s`}
                repeatCount="indefinite"
                keyPoints={flowsForward ? "0;1" : "1;0"}
                keyTimes="0;1"
                calcMode="linear"
                path={`M ${leftX + 6},${wireY} L ${leftX + 42},${wireY}`}
              />
            </circle>
          ))}
          {[0, 0.33, 0.66].map((offset) => (
            <circle key={`r-${offset}`} r={compact ? 2 : 2.4} className={styles.flowDot}>
              <animateMotion
                dur={`${duration}s`}
                begin={`${offset * duration}s`}
                repeatCount="indefinite"
                keyPoints={flowsForward ? "0;1" : "1;0"}
                keyTimes="0;1"
                calcMode="linear"
                path={`M ${rightSegmentStart},${wireY} L ${rightX},${wireY}`}
              />
            </circle>
          ))}
        </g>
      )}

      {/* Paused / reduced motion: hold the dots still. The arrow in the value
          line above still shows which way the current flows. */}
      {!playing && hasFlow && (
        <g className={[styles.flowDots, styles.flowDotsStatic].join(" ")} aria-hidden="true">
          {[0.2, 0.5, 0.8].map((t) => (
            <circle
              key={`ls-${t}`}
              cx={leftX + 6 + 36 * t}
              cy={wireY}
              r={compact ? 2 : 2.4}
              className={styles.flowDot}
            />
          ))}
          {[0.2, 0.5, 0.8].map((t) => (
            <circle
              key={`rs-${t}`}
              cx={rightSegmentStart + (rightX - rightSegmentStart) * t}
              cy={wireY}
              r={compact ? 2 : 2.4}
              className={styles.flowDot}
            />
          ))}
        </g>
      )}

      {/* terminal color dots: orange = source, blue = ground, green = mid-point */}
      <circle
        cx={leftX + 12}
        cy={wireY}
        r="4"
        className={fromIsSource ? styles.terminalDotHot : styles.terminalDotMid}
      />
      <circle
        cx={rightX}
        cy={wireY}
        r="4"
        className={toIsGround ? styles.terminalDotCold : styles.terminalDotMid}
      />

      {/* two-line labels, each anchored to its own terminal -- never
          spans toward the other end, so long names/decimals can't collide */}
      <text x={leftX} y="20" textAnchor="start" className={styles.schematicLabel}>
        {fromLabel}
      </text>
      <text x={leftX} y="34" textAnchor="start" className={styles.schematicLabelValue}>
        {fromIsSource ? "+1A" : `${fromVoltage.toFixed(1)}V`}
      </text>

      <text x={rightX} y="20" textAnchor="end" className={styles.schematicLabel}>
        {toLabel}
      </text>
      <text x={rightX} y="34" textAnchor="end" className={styles.schematicLabelValue}>
        {toIsGround ? "GND" : `${toVoltage.toFixed(1)}V`}
      </text>

      <text x={width / 2 - 20} y="100" textAnchor="middle" className={styles.schematicValue}>
        R = {resistance} Ω &nbsp; c = {conductance.toFixed(4)} Ω⁻¹
      </text>
      <text x={width / 2 - 20} y="118" textAnchor="middle" className={styles.schematicValueStrong}>
        {hasFlow && (flowsForward ? "→ " : "← ")}I = {magnitude.toFixed(4)} A
      </text>
    </svg>
  );
}

/**
 * Stacked horizontal bars comparing candidates: driven + remaining = total
 * resistance. The winner gets its own banner up top plus a checkmark and
 * full color; every losing candidate is dimmed so the eye goes straight to
 * the answer instead of having to compare every bar's length by hand.
 */
export function CandidateBarChart({
  candidates,
}: {
  candidates: { name: string; driven: number; remaining: number; total: number; isChosen: boolean }[];
}) {
  const max = Math.max(...candidates.map((c) => c.total), 1e-6);
  const winner = candidates.find((c) => c.isChosen);
  return (
    <div className={styles.candidateBars}>
      {winner && (
        <p className={styles.candidateWinnerBanner}>
          ✓ A* expands <strong>{winner.name}</strong> next — lowest f = g + h,{" "}
          {winner.total.toFixed(1)} Ω
        </p>
      )}
      {candidates.map((c) => (
        <div
          key={c.name}
          className={[
            styles.candidateBarRow,
            c.isChosen ? styles.candidateBarRowChosen : styles.candidateBarRowLost,
          ].join(" ")}
        >
          <div className={styles.candidateBarHeader}>
            <span className={styles.candidateBarCheck}>{c.isChosen ? "✓" : ""}</span>
            <span className={styles.candidateBarLabel}>{c.name}</span>
          </div>
          <div className={styles.candidateBarMeter}>
            <div className={styles.candidateBarTrack}>
              <div className={styles.candidateBarDriven} style={{ width: `${(c.driven / max) * 100}%` }} />
              <div
                className={styles.candidateBarRemaining}
                style={{ width: `${(c.remaining / max) * 100}%` }}
              />
            </div>
            <span className={styles.candidateBarValue}>{c.total.toFixed(1)} Ω</span>
          </div>
        </div>
      ))}
      <div className={styles.candidateLegend}>
        <span><span className={styles.candidateLegendDriven} /> g: already driven</span>
        <span><span className={styles.candidateLegendRemaining} /> h: remaining to ground</span>
      </div>
    </div>
  );
}

/** A balance scale showing current in vs current out at a terminal. */
export function KclBalanceScale({ totalIn, totalOut }: { totalIn: number; totalOut: number }) {
  const max = Math.max(totalIn, totalOut, 1e-6);
  const balanced = Math.abs(totalIn - totalOut) < 0.01;
  return (
    <div className={styles.balanceWrap}>
      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>In</span>
        <div className={styles.balanceTrack}>
          <div className={styles.balanceFillIn} style={{ width: `${(totalIn / max) * 100}%` }} />
        </div>
        <span className={styles.balanceValue}>{totalIn.toFixed(3)} A</span>
      </div>
      <div className={styles.balanceRow}>
        <span className={styles.balanceLabel}>Out</span>
        <div className={styles.balanceTrack}>
          <div className={styles.balanceFillOut} style={{ width: `${(totalOut / max) * 100}%` }} />
        </div>
        <span className={styles.balanceValue}>{totalOut.toFixed(3)} A</span>
      </div>
      <p className={balanced ? styles.balanceOk : styles.balanceFail}>
        {balanced ? "✓ balanced — nothing piles up here" : "off by rounding"}
      </p>
    </div>
  );
}

/** Grid of small schematics, one per candidate edge leaving a terminal. */
export function SchematicGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.schematicGrid}>{children}</div>;
}