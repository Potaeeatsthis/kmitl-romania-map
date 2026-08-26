// components/benchmark/BenchmarkCharts.tsx
"use client";

import { romaniaGraph } from "../../lib/romaniaGraph";
import type { SearchResult } from "../../lib/types";
import benchmarkData from "../../public/data/benchmark-results.json";
import allPairsRuntimeData from "../../public/data/all-pairs-runtime.json";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./BenchmarkCharts.module.css";

type AllPairsResult = {
  algorithm: "ucs" | "astar";
  label: string;
  expanded: number;
};

type RouteMetricKey =
  | "expanded"
  | "generated"
  | "peak_frontier"
  | "peak_records"
  | "peak_payload_bytes";

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

type PairRuntime = {
  start: number;
  goal: number;
  ucs_runtime_us: number;
  astar_runtime_us: number;
};

type AllPairsRuntime = {
  schema_version: number;
  city_count: number;
  pair_count: number;
  pairs: PairRuntime[];
};

const benchmark = benchmarkData as BenchmarkResults;
const allPairsRuntime = allPairsRuntimeData as AllPairsRuntime;

const ROUTE_METRICS: { key: RouteMetricKey; label: string }[] = [
  { key: "expanded", label: "Expanded nodes" },
  { key: "generated", label: "Generated nodes" },
  { key: "peak_frontier", label: "Peak queue size" },
  { key: "peak_records", label: "Peak records" },
  { key: "peak_payload_bytes", label: "Logical memory" },
];

export default function BenchmarkCharts() {
  const routeData = useSearchStore((state) => state.data);
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const isLoading = useSearchStore((state) => state.isLoading);
  const error = useSearchStore((state) => state.error);

  const allUcs = benchmark.all_pairs.results.find((result) => result.algorithm === "ucs");
  const allAstar = benchmark.all_pairs.results.find((result) => result.algorithm === "astar");

  if (!allUcs || !allAstar) {
    return <p role="status">Benchmark data is incomplete.</p>;
  }

  if (startCity === null || destinationCity === null) {
    return (
      <div className={styles.wrapper + " " + styles.stack}>
        <div className={styles.header}>
          <p className={styles.kicker}>BENCHMARK</p>
          <h2 className={styles.title}>UCS vs Current-flow A*</h2>
        </div>
        <p className={styles.pending} role="status">
          Choose a starting point and a destination to see route details.
        </p>
        <p className={styles.heroMethod}>
          All {benchmark.all_pairs.route_count.toLocaleString("en-US")} pairs:{" "}
          {allUcs.expanded.toLocaleString("en-US")} → {allAstar.expanded.toLocaleString("en-US")} expansions
          ({benchmark.all_pairs.comparison.expanded_reduction_percent}% fewer).
        </p>
      </div>
    );
  }

  const startName = romaniaGraph.cities[startCity]?.name ?? "Unknown city";
  const destinationName = romaniaGraph.cities[destinationCity]?.name ?? "Unknown city";

  // Native, precomputed per-pair timing (I5: never measured live in the browser).
  const selectedRuntime: PairRuntime | undefined =
    allPairsRuntime.pairs[startCity * allPairsRuntime.city_count + destinationCity];
  const selectedRuntimeReductionPercent = selectedRuntime
    ? ((selectedRuntime.ucs_runtime_us - selectedRuntime.astar_runtime_us) /
        selectedRuntime.ucs_runtime_us) *
      100
    : null;

  const selectedExpansionPercent =
    routeData && routeData.ucs.expanded > 0
      ? Math.round(
          ((routeData.ucs.expanded - routeData.astar.expanded) / routeData.ucs.expanded) * 100,
        )
      : null;
  const selectedExpansionLabel =
    selectedExpansionPercent === null
      ? "Run a route to compare expansions"
      : selectedExpansionPercent > 0
        ? selectedExpansionPercent + "% fewer expansions"
        : selectedExpansionPercent < 0
          ? Math.abs(selectedExpansionPercent) + "% more expansions"
          : "Same number of expansions";

  return (
    <div className={styles.wrapper + " " + styles.stack}>
      <div className={styles.header}>
        <p className={styles.kicker}>BENCHMARK</p>
        <h2 className={styles.title}>UCS vs Current-flow A*</h2>
      </div>

      <div className={styles.hero}>
        <div className={styles.ringGrid}>
          <div className={styles.ringMetric}>
            <span className={styles.ringKicker}>SELECTED ROUTE</span>
            <div className={styles.heroRingWrap}>
              <HeroRing
                percent={Math.min(Math.abs(selectedExpansionPercent ?? 0), 100)}
                value={selectedExpansionPercent === null ? "—" : Math.abs(selectedExpansionPercent) + "%"}
                label={selectedExpansionLabel}
                isWorse={(selectedExpansionPercent ?? 0) < 0}
              />
            </div>

            <p className={styles.heroDelta}>{selectedExpansionLabel}</p>

            {routeData && (
              <p className={styles.heroComparison}>
                UCS {routeData.ucs.expanded.toLocaleString("en-US")} → A*{" "}
                {routeData.astar.expanded.toLocaleString("en-US")} expansions
              </p>
            )}
          </div>

          {selectedRuntime && (
            <div className={styles.ringMetric}>
              <span className={styles.ringKicker}>NATIVE SPEED SAMPLE</span>
              <div className={styles.heroRingWrap}>
                <HeroRing
                  percent={Math.min(Math.abs(selectedRuntimeReductionPercent ?? 0), 100)}
                  value={selectedRuntime.astar_runtime_us.toFixed(3)}
                  unit="µs"
                  label={
                    "A* median runtime " +
                    selectedRuntime.astar_runtime_us.toFixed(3) +
                    " microseconds; " +
                    Math.abs(selectedRuntimeReductionPercent ?? 0).toFixed(1) +
                    "% " +
                    ((selectedRuntimeReductionPercent ?? 0) < 0 ? "slower than" : "faster than") +
                    " UCS on " +
                    startName +
                    " to " +
                    destinationName
                  }
                  isWorse={(selectedRuntimeReductionPercent ?? 0) < 0}
                />
              </div>

              <p className={styles.heroDelta}>A* median runtime</p>
              <p className={styles.heroComparison}>
                UCS {selectedRuntime.ucs_runtime_us.toFixed(3)} → A*{" "}
                {selectedRuntime.astar_runtime_us.toFixed(3)} µs
              </p>
              <p className={styles.speedRoute}>
                {startName} → {destinationName}
              </p>
            </div>
          )}
        </div>

        <p className={styles.heroMethod}>
          All {benchmark.all_pairs.route_count.toLocaleString("en-US")} pairs:{" "}
          {allUcs.expanded.toLocaleString("en-US")} → {allAstar.expanded.toLocaleString("en-US")} expansions
          ({benchmark.all_pairs.comparison.expanded_reduction_percent}% fewer).
        </p>
      </div>

      <div className={styles.heroDivider} />

      <section className={styles.routeSummary} aria-labelledby="selected-route-title">
        <span className={styles.routeLabel}>SELECTED ROUTE</span>
        <div className={styles.routeTitleRow}>
          <h3 id="selected-route-title" className={styles.routeTitle}>
            {startName} → {destinationName}
          </h3>
          {routeData && (
            <strong className={styles.routeCost}>{formatCost(routeData.ucs, routeData.astar)}</strong>
          )}
        </div>

        {routeData ? (
          <RoutePaths ucs={routeData.ucs} astar={routeData.astar} />
        ) : (
          <p className={error ? styles.errorState : styles.pending} role="status">
            {error ?? (isLoading ? "Running the Rust search…" : "Run this route to see its details.")}
          </p>
        )}
      </section>

      {routeData && (
        <>
          <div className={styles.divLegend} aria-label="Selected-route chart legend">
            <span><span className={styles.swatchUcs} />UCS ◀</span>
            <span>▶ A*<span className={styles.swatchAstar} /></span>
          </div>

          {ROUTE_METRICS.map((metric) => (
            <DivergingRow
              key={metric.key}
              metricKey={metric.key}
              label={metric.label}
              ucs={routeData.ucs[metric.key]}
              astar={routeData.astar[metric.key]}
            />
          ))}

        </>
      )}
    </div>
  );
}

function HeroRing({
  percent,
  value,
  unit,
  label,
  isWorse,
}: {
  percent: number;
  value: string;
  unit?: string;
  label: string;
  isWorse: boolean;
}) {
  const size = 112;
  const strokeWidth = 9.5;
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
      aria-label={label}
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
        className={styles.heroRingProgress + (isWorse ? " " + styles.heroRingWorse : "")}
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
      {unit ? (
        <>
          <text className={styles.heroRingLabel} x="50%" y="48%" textAnchor="middle">
            {value}
          </text>
          <text className={styles.heroRingUnit} x="50%" y="65%" textAnchor="middle">
            {unit}
          </text>
        </>
      ) : (
        <text
          className={styles.heroRingLabel}
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {value}
        </text>
      )}
    </svg>
  );
}

function RoutePaths({ ucs, astar }: { ucs: SearchResult; astar: SearchResult }) {
  const ucsPath = formatPath(ucs.path);
  const astarPath = formatPath(astar.path);

  if (ucsPath === astarPath) {
    return <p className={styles.routePath}><span>PATH</span> {ucsPath}</p>;
  }

  return (
    <div className={styles.splitPaths}>
      <p className={styles.routePath}><span>UCS</span> {ucsPath}</p>
      <p className={styles.routePath}><span>A*</span> {astarPath}</p>
    </div>
  );
}

function DivergingRow({
  metricKey,
  label,
  ucs,
  astar,
}: {
  metricKey: RouteMetricKey;
  label: string;
  ucs: number;
  astar: number;
}) {
  const max = Math.max(ucs, astar) || 1;
  const ucsPct = (ucs / max) * 100;
  const astarPct = (astar / max) * 100;
  const astarWorse = astar > ucs;

  return (
    <div className={styles.divRow}>
      <div className={styles.divLabel}>{label}</div>
      <div className={styles.divTrack}>
        <span className={styles.divValLeft}>{formatMetric(metricKey, ucs)}</span>
        <div className={styles.divBarAreaLeft} aria-hidden="true">
          <div
            className={styles.divBar + " " + styles.divBarUcs}
            style={{ width: ucsPct + "%" }}
          />
        </div>
        <div className={styles.divAxis} aria-hidden="true" />
        <div className={styles.divBarAreaRight} aria-hidden="true">
          <div
            className={styles.divBar + " " + styles.divBarAstar}
            style={{ width: astarPct + "%" }}
          />
        </div>
        <span className={styles.divValRight}>{formatMetric(metricKey, astar)}</span>
      </div>
      {astarWorse && <div className={styles.divNote}>A* uses more for this metric.</div>}
    </div>
  );
}

function formatPath(path: number[]) {
  if (path.length === 0) return "No path found";
  return path.map((cityId) => romaniaGraph.cities[cityId]?.name ?? `City ${cityId}`).join(" → ");
}

function formatCost(ucs: SearchResult, astar: SearchResult) {
  if (ucs.cost === astar.cost) return `${ucs.cost.toLocaleString("en-US")} km`;
  return `UCS ${ucs.cost.toLocaleString("en-US")} km · A* ${astar.cost.toLocaleString("en-US")} km`;
}

function formatMetric(metric: RouteMetricKey, value: number) {
  if (metric === "peak_payload_bytes") {
    return `${value.toLocaleString("en-US")} B`;
  }

  return value.toLocaleString("en-US");
}
