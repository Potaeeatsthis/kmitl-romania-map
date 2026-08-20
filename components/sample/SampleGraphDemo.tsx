// components/sample/SampleGraphDemo.tsx
"use client";

import { useEffect, useState } from "react";
import { countyOutlines } from "../../lib/countyOutlines";
import sampleData from "../../public/data/arad-bucharest-search.json";
import type { DiscoveredNode, SearchResponse, SearchResult } from "../../lib/types";
import { romaniaGraph } from "../../lib/romaniaGraph";
import styles from "./SampleGraphDemo.module.css";

const sample = sampleData as SearchResponse;
const FRAME_DURATION_MS = 850;

const labelOffsets: Record<number, { x: number; y: number }> = {
  0: { x: -21, y: -5 },   1: { x: -20, y: -10 },  2: { x: -3, y: -22 },
  3: { x: 7, y: -21 },    4: { x: -22, y: 16 },   5: { x: 13, y: -18 },
  6: { x: -34, y: 4 },   7: { x: -14, y: 19 },   8: { x: 3, y: 24 },
  9: { x: 30, y: -21 },   10: { x: 12, y: -20 },  11: { x: 11, y: -21 },
  12: { x: 34, y: 20 },   13: { x: -4, y: 23 },   14: { x: -20, y: -15 },
  15: { x: 11, y: -21 },  16: { x: 13, y: 17 },   17: { x: 32, y: -10 },
  18: { x: 12, y: -18 },  19: { x: -32, y: 0 },
};

// Real Romania border. Source: Natural Earth 50m admin-0 boundary,
// projected with an equirectangular projection then fitted to the
// real-geography city positions in lib/romaniaGraph.ts via a Procrustes
// (rotation + uniform scale + translation) transform.
const COUNTRY_OUTLINE_PATH = `
  M 867.7,443.9 L 877.4,457.5 L 889.7,464.7 L 918.1,472.3 L 920.7,471.4
  L 920.0,462.4 L 930.4,465.0 L 960.7,450.2 L 977.2,448.0 L 992.3,454.4
  L 1005.0,468.9 L 998.5,505.7 L 991.4,523.6 L 944.5,534.8 L 947.6,529.4
  L 944.5,512.8 L 948.9,506.3 L 938.3,503.9 L 930.1,513.7 L 933.3,527.9
  L 926.2,540.2 L 922.4,560.1 L 929.8,558.8 L 926.5,567.8 L 907.5,595.4
  L 908.7,636.3 L 902.0,668.0 L 887.1,668.2 L 868.6,664.0 L 852.8,657.5
  L 837.5,635.8 L 824.2,639.9 L 817.9,634.5 L 807.8,631.5 L 795.4,631.5
  L 764.2,612.2 L 709.3,623.2 L 684.2,633.2 L 658.2,651.1 L 647.7,664.7
  L 635.5,672.0 L 618.1,677.3 L 587.1,675.3 L 520.1,661.1 L 501.3,665.2
  L 409.2,650.7 L 381.1,655.9 L 376.4,651.9 L 376.4,641.0 L 390.8,628.0
  L 391.2,623.9 L 359.9,601.6 L 359.4,596.6 L 345.4,584.6 L 342.1,577.1
  L 342.8,570.0 L 347.6,563.3 L 353.6,560.4 L 361.0,561.3 L 364.1,559.4
  L 362.9,554.8 L 342.4,541.5 L 328.9,545.5 L 315.1,560.6 L 305.2,563.1
  L 299.1,552.9 L 288.3,546.8 L 263.2,541.0 L 252.8,530.5 L 237.8,525.8
  L 237.6,521.1 L 252.5,518.6 L 253.6,516.0 L 253.7,513.7 L 239.4,506.5
  L 237.1,501.8 L 243.4,498.7 L 249.8,483.6 L 244.4,477.8 L 225.5,471.4
  L 218.3,464.8 L 206.9,460.8 L 185.8,441.7 L 184.0,404.7 L 178.0,406.6
  L 166.2,389.0 L 145.7,375.1 L 135.0,357.6 L 138.6,354.4 L 159.5,350.0
  L 169.2,354.4 L 177.8,349.2 L 182.7,339.6 L 189.7,337.8 L 208.4,340.1
  L 215.9,334.8 L 222.3,320.5 L 229.0,317.8 L 227.9,308.1 L 234.1,292.1
  L 250.4,279.5 L 250.2,268.3 L 264.7,245.5 L 265.5,235.0 L 276.9,222.6
  L 284.6,200.8 L 296.2,188.8 L 296.6,174.5 L 323.3,145.3 L 341.8,139.4
  L 352.6,140.2 L 377.2,116.5 L 393.6,108.7 L 401.4,98.1 L 407.2,98.5
  L 426.1,110.9 L 450.1,110.6 L 480.6,118.0 L 486.0,116.8 L 496.8,121.9
  L 525.0,116.5 L 533.7,118.6 L 562.6,146.6 L 579.2,142.9 L 588.0,132.8
  L 615.1,121.3 L 679.3,110.5 L 689.8,94.7 L 692.4,82.8 L 729.9,75.0
  L 747.2,81.9 L 754.5,89.2 L 770.2,114.9 L 787.2,156.8 L 797.6,168.2
  L 812.7,196.0 L 826.9,210.9 L 834.7,225.7 L 854.8,243.5 L 870.2,287.8
  L 870.6,312.7 L 859.1,353.7 L 857.4,375.5 L 862.9,418.1 L 855.1,424.5
  L 867.7,443.9 Z
`;

export default function SampleGraphDemo() {
  const [step, setStep] = useState(0);
  const timelineLength = Math.max(sample.ucs.trace.length, sample.astar.trace.length);
  const animationComplete = step >= timelineLength - 1;

  useEffect(() => {
    if (animationComplete) return;
    const timer = window.setTimeout(() => setStep((current) => current + 1), FRAME_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [animationComplete, step]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>RUST TRACE / ARAD TO BUCHAREST</p>
          <h1 className={styles.title}>Romania search</h1>
        </div>
        {animationComplete ? (
          <button className={[styles.status, styles.replay].join(" ")} type="button" onClick={() => setStep(0)}>
            Animation complete — replay
          </button>
        ) : (
          <p className={styles.status}>Auto-playing frame {step + 1} of {timelineLength}</p>
        )}
      </header>
      <DemoContent data={sample} step={step} timelineLength={timelineLength} />
    </main>
  );
}

function DemoContent({ data, step, timelineLength }: { data: SearchResponse; step: number; timelineLength: number }) {
  const cityById = new Map(romaniaGraph.cities.map((city) => [city.id, city]));
  const ucsIndex = Math.min(step, data.ucs.trace.length - 1);
  const astarIndex = Math.min(step, data.astar.trace.length - 1);
  const ucsFrame = data.ucs.trace[ucsIndex];
  const astarFrame = data.astar.trace[astarIndex];
  const ucsExpanded = new Set(data.ucs.explored_order.slice(0, ucsIndex + 1));
  const astarExpanded = new Set(data.astar.explored_order.slice(0, astarIndex + 1));
  const ucsFrontier = new Set(ucsFrame.frontier.map((node) => node.city));
  const astarFrontier = new Set(astarFrame.frontier.map((node) => node.city));
  const ucsComplete = step >= data.ucs.trace.length - 1;
  const astarComplete = step >= data.astar.trace.length - 1;
  const finalPath = new Set([...(ucsComplete ? data.ucs.path : []), ...(astarComplete ? data.astar.path : [])]);

  return (
    <section className={styles.content}>
      <div className={styles.mapPanel}>
        <svg className={styles.map} viewBox="120 60 900 630" aria-label="Animated Romania road graph" role="img">
          <g className={styles.countyLines}>
            {countyOutlines.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>
          <path className={styles.countryOutline} d={COUNTRY_OUTLINE_PATH} />

          <g className={styles.roads}>
            {romaniaGraph.roads.map(([from, to]) => {
              const start = cityById.get(from);
              const end = cityById.get(to);
              if (!start || !end) return null;
              return <line key={from + "-" + to} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
            })}
          </g>

          <SearchTreeLines discovered={ucsFrame.discovered} cityById={cityById} className={styles.ucsTree} offset={-2} />
          <SearchTreeLines discovered={astarFrame.discovered} cityById={cityById} className={styles.astarTree} offset={2} />
          {ucsComplete && <PathLines result={data.ucs} cityById={cityById} className={styles.ucsPath} offset={-3} />}
          {astarComplete && <PathLines result={data.astar} cityById={cityById} className={styles.astarPath} offset={3} />}

          <g className={styles.roadLabels}>
            {romaniaGraph.roads.map(([from, to, distance]) => {
              const start = cityById.get(from);
              const end = cityById.get(to);
              if (!start || !end) return null;
              const position = roadLabelPosition(start, end);
              return <text key={from + "-" + to} x={position.x} y={position.y}>{distance}</text>;
            })}
          </g>

          {romaniaGraph.cities.map((city) => {
            const offset = labelOffsets[city.id] ?? { x: 0, y: 22 };
            const inUcsFrontier = ucsFrontier.has(city.id);
            const inAstarFrontier = astarFrontier.has(city.id);
            const classes = [
              styles.city,
              ucsExpanded.has(city.id) || astarExpanded.has(city.id) ? styles.expanded : "",
              inUcsFrontier && inAstarFrontier ? styles.frontierBoth : inUcsFrontier ? styles.frontierUcs : inAstarFrontier ? styles.frontierAstar : "",
              ucsFrame.expanded_city === city.id || astarFrame.expanded_city === city.id ? styles.active : "",
              finalPath.has(city.id) ? styles.path : "",
            ].filter(Boolean).join(" ");

            return (
              <g key={city.id} className={classes}>
                <rect x={city.x - 5} y={city.y - 5} width="10" height="10" rx="2" />
                <text x={city.x + offset.x} y={city.y + offset.y}>{city.name}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <aside className={styles.panel}>
        <p className={styles.kicker}>SAMPLE TRACE</p>
        <h2>UCS and current-flow A*</h2>
        <div className={styles.progress} aria-hidden="true">
          <span style={{ width: `${((step + 1) / timelineLength) * 100}%` }} />
        </div>
        <div className={styles.currentGrid}>
          <Metric label="UCS expanded now" value={romaniaGraph.cities[ucsFrame.expanded_city].name} />
          <Metric label="A* expanded now" value={romaniaGraph.cities[astarFrame.expanded_city].name} />
        </div>
        <div className={styles.metrics}>
          <Metric label="UCS distance" value={`${data.ucs.cost} km`} />
          <Metric label="A* distance" value={`${data.astar.cost} km`} />
          <Metric label="UCS expanded" value={data.ucs.expanded} />
          <Metric label="A* expanded" value={data.astar.expanded} />
        </div>
        <div className={styles.legend}>
          <p className={styles.kicker}>TRACE LEGEND</p>
          <Legend className={styles.swatchCity} label="Not discovered" />
          <Legend className={styles.swatchExpanded} label="Expanded" />
          <Legend className={styles.swatchUcs} label="UCS frontier / tree" />
          <Legend className={styles.swatchAstar} label="A* frontier / tree" />
          <Legend className={styles.swatchPath} label="Final optimal path" />
        </div>
      </aside>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Legend({ className, label }: { className: string; label: string }) {
  return <div className={styles.legendRow}><span className={className} />{label}</div>;
}

type CityPosition = (typeof romaniaGraph.cities)[number];

function roadLabelPosition(start: CityPosition, end: CityPosition) {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const offset = 13;

  return {
    x: (start.x + end.x) / 2 - (deltaY / length) * offset,
    y: (start.y + end.y) / 2 + (deltaX / length) * offset,
  };
}

function SearchTreeLines({ discovered, cityById, className, offset }: { discovered: DiscoveredNode[]; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  return (
    <g className={styles.searchTree}>
      {discovered.map((node) => node.parent === null ? null : (
        <GraphLine key={`${node.parent}-${node.city}`} from={node.parent} to={node.city} cityById={cityById} className={className} offset={offset} />
      ))}
    </g>
  );
}

function PathLines({ result, cityById, className, offset }: { result: SearchResult; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  return (
    <g className={styles.finalPath}>
      {result.path.slice(0, -1).map((city, index) => (
        <GraphLine key={`${city}-${result.path[index + 1]}`} from={city} to={result.path[index + 1]} cityById={cityById} className={className} offset={offset} />
      ))}
    </g>
  );
}

function GraphLine({ from, to, cityById, className, offset }: { from: number; to: number; cityById: Map<number, CityPosition>; className: string; offset: number }) {
  const start = cityById.get(from);
  const end = cityById.get(to);
  if (!start || !end) return null;
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const shiftX = (-(end.y - start.y) / length) * offset;
  const shiftY = ((end.x - start.x) / length) * offset;
  return <line className={className} x1={start.x + shiftX} y1={start.y + shiftY} x2={end.x + shiftX} y2={end.y + shiftY} />;
}