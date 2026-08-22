// components/benchmark/BenchmarkCharts.tsx
"use client";

import benchmarkData from "../../public/data/benchmark-results.json";
import styles from "./BenchmarkCharts.module.css";

type AllPairsResult = {
  algorithm: "ucs" | "astar";
  label: string;
  expanded: number;
};

type SampleAlgorithmResult = {
  algorithm: "ucs" | "astar";
  label: string;
  median_runtime_us: number;
  expanded: number;
  generated: number;
  peak_frontier: number;
  peak_records: number;
  logical_memory_bytes: number;
};

type BenchmarkResults = {
  schema_version: number;
  recorded_at: string;
  all_pairs: {
    city_count: number;
    route_count: number;
    includes_same_city_routes: boolean;
    results: AllPairsResult[];
    comparison: {
      expanded_reduction: number;
      expanded_reduction_percent: number;
      optimal_cost_mismatches: number;
      admissibility_violations: number;
      consistency_violations: number;
    };
  };
  sample_route: {
    start: { id: number; name: string };
    goal: { id: number; name: string };
    cost_km: number;
    results: SampleAlgorithmResult[];
    comparison: {
      expanded_reduction_percent: number;
      runtime_reduction_percent: number;
      logical_memory_reduction_percent: number;
    };
  };
  runtime_method: {
    source: string;
    build_profile: string;
    process_launches: number;
    searches_per_algorithm_per_launch: number;
    statistic: string;
    heuristic_build_excluded: boolean;
    trace_recording_enabled: boolean;
    unit: string;
  };
  memory_method: Record<string, unknown>;
};

const data = benchmarkData as BenchmarkResults;

const METRICS: {
  key: "expanded" | "generated" | "peak_frontier" | "logical_memory_bytes";
  label: string;
}[] = [
  { key: "expanded", label: "Expanded nodes" },
  { key: "generated", label: "Generated nodes" },
  { key: "peak_frontier", label: "Peak queue size" },
  { key: "logical_memory_bytes", label: "Memory (bytes)" },
];

export default function BenchmarkCharts({ variant = "grid" }: { variant?: "grid" | "stack" }) {
  const ucs = data.sample_route.results.find((result) => result.algorithm === "ucs");
  const astar = data.sample_route.results.find((result) => result.algorithm === "astar");

  const allUcs = data.all_pairs.results.find((result) => result.algorithm === "ucs");
  const allAstar = data.all_pairs.results.find((result) => result.algorithm === "astar");

  if (!ucs || !astar) return null;

  return (
    <div className={styles.wrapper + (variant === "stack" ? " " + styles.stack : "")}>
      <div className={styles.header}>
        <p className={styles.kicker}>BENCHMARK</p>
        <h2 className={styles.title}>UCS vs Current-flow A*</h2>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroRingWrap}>
          <HeroRing percent={data.all_pairs.comparison.expanded_reduction_percent} />
        </div>

        {allUcs && allAstar && (
          <p className={styles.heroDelta}>
            {allUcs.expanded.toLocaleString()} → {allAstar.expanded.toLocaleString()} nodes
          </p>
        )}

        <p className={styles.heroMethod}>
          Across all {data.all_pairs.route_count} city pairs · 5 warmup + 30 measured runs
        </p>
      </div>

      <div className={styles.heroDivider} />

      <div className={styles.divLegend}>
        <span><span className={styles.swatchUcs} />UCS ◀</span>
        <span>▶ A*<span className={styles.swatchAstar} /></span>
      </div>

      {METRICS.map((metric) => (
        <DivergingRow
          key={metric.key}
          label={metric.label}
          ucs={ucs[metric.key]}
          astar={astar[metric.key]}
        />
      ))}

      <p className={styles.footnote}>
        Sample route: {data.sample_route.start.name} → {data.sample_route.goal.name} (
        {data.sample_route.cost_km} km). Source: public/data/benchmark-results.json
        (native Rust CLI, committed).
      </p>
    </div>
  );
}

function HeroRing({ percent }: { percent: number }) {
  const size = 150;
  const strokeWidth = 12.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <svg
      className={styles.heroRing}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${percent}% fewer nodes expanded`}
    >
      <circle
        className={styles.heroRingTrack}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        className={styles.heroRingProgress}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        className={styles.heroRingLabel}
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {percent}%
      </text>
    </svg>
  );
}

function DivergingRow({
  label,
  ucs,
  astar,
}: {
  label: string;
  ucs: number | null;
  astar: number | null;
}) {
  if (ucs === null || astar === null) {
    return (
      <div className={styles.divRow}>
        <div className={styles.divLabel}>{label}</div>
        <div className={styles.pending}>
          <span className={styles.pendingText}>awaiting benchmark data</span>
        </div>
      </div>
    );
  }

  const max = Math.max(ucs, astar) || 1;
  const ucsPct = (ucs / max) * 100;
  const astarPct = (astar / max) * 100;
  const astarWorse = astar > ucs; // lower is better for all four metrics

  return (
    <div className={styles.divRow}>
      <div className={styles.divLabel}>{label}</div>
      <div className={styles.divTrack}>
        <span className={styles.divValLeft}>{ucs.toLocaleString()}</span>
        <div className={styles.divBarAreaLeft}>
          <div
            className={styles.divBar + " " + styles.divBarUcs}
            style={{ width: ucsPct + "%" }}
          />
        </div>
        <div className={styles.divAxis} />
        <div className={styles.divBarAreaRight}>
          <div
            className={styles.divBar + " " + styles.divBarAstar}
            style={{ width: astarPct + "%" }}
          />
        </div>
        <span className={styles.divValRight}>{astar.toLocaleString()}</span>
      </div>
      {astarWorse && (
        <div className={styles.divNote}>▲ A* holds more here — an honest trade-off</div>
      )}
    </div>
  );
}