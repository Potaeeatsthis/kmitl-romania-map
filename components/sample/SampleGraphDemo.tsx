"use client";

import { useEffect, useState } from "react";

import sampleData from "../../public/data/arad-bucharest-search.json";
import type { DiscoveredNode, SearchResponse, SearchResult } from "../../lib/types";
import { romaniaGraph } from "../../lib/romaniaGraph";
import styles from "./SampleGraphDemo.module.css";

const sample = sampleData as SearchResponse;
const FRAME_DURATION_MS = 850;

const labelOffsets: Record<number, { x: number; y: number }> = {
  0: { x: -22, y: -14 }, 1: { x: 22, y: 20 }, 2: { x: 0, y: 24 },
  3: { x: 0, y: 25 }, 4: { x: -4, y: 25 }, 5: { x: 0, y: -14 },
  6: { x: -4, y: 25 }, 7: { x: 0, y: 25 }, 8: { x: 0, y: -14 },
  9: { x: 32, y: -12 }, 10: { x: 30, y: 25 }, 11: { x: 0, y: -14 },
  12: { x: 0, y: 25 }, 13: { x: 0, y: 25 }, 14: { x: 24, y: -16 },
  15: { x: 0, y: 25 }, 16: { x: 0, y: 25 }, 17: { x: 0, y: 25 },
  18: { x: 0, y: -14 }, 19: { x: 0, y: 25 },
};

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
        <svg className={styles.map} viewBox="85 90 710 500" aria-label="Animated Romania road graph" role="img">
          <g className={styles.roads}>
            {romaniaGraph.roads.map(([from, to, distance]) => {
              const start = cityById.get(from);
              const end = cityById.get(to);
              if (!start || !end) return null;
              return (
                <g key={`${from}-${to}`}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
                  <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 5}>{distance}</text>
                </g>
              );
            })}
          </g>

          <SearchTreeLines discovered={ucsFrame.discovered} cityById={cityById} className={styles.ucsTree} offset={-2} />
          <SearchTreeLines discovered={astarFrame.discovered} cityById={cityById} className={styles.astarTree} offset={2} />
          {ucsComplete && <PathLines result={data.ucs} cityById={cityById} className={styles.ucsPath} offset={-3} />}
          {astarComplete && <PathLines result={data.astar} cityById={cityById} className={styles.astarPath} offset={3} />}

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
                <rect x={city.x - 10} y={city.y - 10} width="20" height="20" rx="3" />
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
