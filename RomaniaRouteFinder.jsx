import { useState, useEffect } from "react";
import { Play, Pause, SkipForward, RotateCcw, Search, HelpCircle, X, ArrowRight, MapPin } from "lucide-react";

const VB = { w: 1040, h: 737 };
const DOTS = [[45,349],[64,330],[64,349],[64,368],[83,330],[83,349],[83,368],[83,387],[102,330],[102,349],[102,368],[102,387],[102,406],[102,425],[102,444],[121,311],[121,330],[121,349],[121,368],[121,387],[121,406],[121,425],[121,444],[121,463],[140,273],[140,292],[140,311],[140,330],[140,349],[140,368],[140,387],[140,406],[140,425],[140,444],[140,463],[159,254],[159,273],[159,292],[159,311],[159,330],[159,349],[159,368],[159,387],[159,406],[159,425],[159,444],[159,463],[159,482],[178,216],[178,235],[178,254],[178,273],[178,292],[178,311],[178,330],[178,349],[178,368],[178,387],[178,406],[178,425],[178,444],[178,463],[178,482],[178,501],[178,520],[178,539],[197,178],[197,197],[197,216],[197,235],[197,254],[197,273],[197,292],[197,311],[197,330],[197,349],[197,368],[197,387],[197,406],[197,425],[197,444],[197,463],[197,482],[197,501],[197,520],[197,539],[197,558],[216,140],[216,159],[216,178],[216,197],[216,216],[216,235],[216,254],[216,273],[216,292],[216,311],[216,330],[216,349],[216,368],[216,387],[216,406],[216,425],[216,444],[216,463],[216,482],[216,501],[216,520],[216,539],[216,558],[216,577],[235,121],[235,140],[235,159],[235,178],[235,197],[235,216],[235,235],[235,254],[235,273],[235,292],[235,311],[235,330],[235,349],[235,368],[235,387],[235,406],[235,425],[235,444],[235,463],[235,482],[235,501],[235,520],[235,539],[235,558],[235,577],[254,102],[254,121],[254,140],[254,159],[254,178],[254,197],[254,216],[254,235],[254,254],[254,273],[254,292],[254,311],[254,330],[254,349],[254,368],[254,387],[254,406],[254,425],[254,444],[254,463],[254,482],[254,501],[254,520],[254,539],[254,558],[273,102],[273,121],[273,140],[273,159],[273,178],[273,197],[273,216],[273,235],[273,254],[273,273],[273,292],[273,311],[273,330],[273,349],[273,368],[273,387],[273,406],[273,425],[273,444],[273,463],[273,482],[273,501],[273,520],[273,539],[273,558],[273,596],[273,615],[292,83],[292,102],[292,121],[292,140],[292,159],[292,178],[292,197],[292,216],[292,235],[292,254],[292,273],[292,292],[292,311],[292,330],[292,349],[292,368],[292,387],[292,406],[292,425],[292,444],[292,463],[292,482],[292,501],[292,520],[292,539],[292,558],[292,577],[292,596],[292,615],[292,634],[311,64],[311,83],[311,102],[311,121],[311,140],[311,159],[311,178],[311,197],[311,216],[311,235],[311,254],[311,273],[311,292],[311,311],[311,330],[311,349],[311,368],[311,387],[311,406],[311,425],[311,444],[311,463],[311,482],[311,501],[311,520],[311,539],[311,558],[311,577],[311,596],[311,615],[311,634],[311,653],[311,672],[330,64],[330,83],[330,102],[330,121],[330,140],[330,159],[330,178],[330,197],[330,216],[330,235],[330,254],[330,273],[330,292],[330,311],[330,330],[330,349],[330,368],[330,387],[330,406],[330,425],[330,444],[330,463],[330,482],[330,501],[330,520],[330,539],[330,558],[330,577],[330,596],[330,615],[330,634],[330,653],[330,672],[349,64],[349,83],[349,102],[349,121],[349,140],[349,159],[349,178],[349,197],[349,216],[349,235],[349,254],[349,273],[349,292],[349,311],[349,330],[349,349],[349,368],[349,387],[349,406],[349,425],[349,444],[349,463],[349,482],[349,501],[349,520],[349,539],[349,558],[349,577],[349,596],[349,615],[349,634],[349,653],[349,672],[368,64],[368,83],[368,102],[368,121],[368,140],[368,159],[368,178],[368,197],[368,216],[368,235],[368,254],[368,273],[368,292],[368,311],[368,330],[368,349],[368,368],[368,387],[368,406],[368,425],[368,444],[368,463],[368,482],[368,501],[368,520],[368,539],[368,558],[368,577],[368,596],[368,615],[368,634],[368,653],[368,672],[387,64],[387,83],[387,102],[387,121],[387,140],[387,159],[387,178],[387,197],[387,216],[387,235],[387,254],[387,273],[387,292],[387,311],[387,330],[387,349],[387,368],[387,387],[387,406],[387,425],[387,444],[387,463],[387,482],[387,501],[387,520],[387,539],[387,558],[387,577],[387,596],[387,615],[387,634],[387,653],[387,672],[406,64],[406,83],[406,102],[406,121],[406,140],[406,159],[406,178],[406,197],[406,216],[406,235],[406,254],[406,273],[406,292],[406,311],[406,330],[406,349],[406,368],[406,387],[406,406],[406,425],[406,444],[406,463],[406,482],[406,501],[406,520],[406,539],[406,558],[406,577],[406,596],[406,615],[406,634],[406,653],[406,672],[406,691],[425,64],[425,83],[425,102],[425,121],[425,140],[425,159],[425,178],[425,197],[425,216],[425,235],[425,254],[425,273],[425,292],[425,311],[425,330],[425,349],[425,368],[425,387],[425,406],[425,425],[425,444],[425,463],[425,482],[425,501],[425,520],[425,539],[425,558],[425,577],[425,596],[425,615],[425,634],[425,653],[425,672],[425,691],[444,64],[444,83],[444,102],[444,121],[444,140],[444,159],[444,178],[444,197],[444,216],[444,235],[444,254],[444,273],[444,292],[444,311],[444,330],[444,349],[444,368],[444,387],[444,406],[444,425],[444,444],[444,463],[444,482],[444,501],[444,520],[444,539],[444,558],[444,577],[444,596],[444,615],[444,634],[444,653],[444,672],[444,691],[463,64],[463,83],[463,102],[463,121],[463,140],[463,159],[463,178],[463,197],[463,216],[463,235],[463,254],[463,273],[463,292],[463,311],[463,330],[463,349],[463,368],[463,387],[463,406],[463,425],[463,444],[463,463],[463,482],[463,501],[463,520],[463,539],[463,558],[463,577],[463,596],[463,615],[463,634],[463,653],[463,672],[463,691],[482,83],[482,102],[482,121],[482,140],[482,159],[482,178],[482,197],[482,216],[482,235],[482,254],[482,273],[482,292],[482,311],[482,330],[482,349],[482,368],[482,387],[482,406],[482,425],[482,444],[482,463],[482,482],[482,501],[482,520],[482,539],[482,558],[482,577],[482,596],[482,615],[482,634],[482,653],[482,672],[482,691],[501,102],[501,121],[501,140],[501,159],[501,178],[501,197],[501,216],[501,235],[501,254],[501,273],[501,292],[501,311],[501,330],[501,349],[501,368],[501,387],[501,406],[501,425],[501,444],[501,463],[501,482],[501,501],[501,520],[501,539],[501,558],[501,577],[501,596],[501,615],[501,634],[501,653],[501,672],[501,691],[520,102],[520,121],[520,140],[520,159],[520,178],[520,197],[520,216],[520,235],[520,254],[520,273],[520,292],[520,311],[520,330],[520,349],[520,368],[520,387],[520,406],[520,425],[520,444],[520,463],[520,482],[520,501],[520,520],[520,539],[520,558],[520,577],[520,596],[520,615],[520,634],[520,653],[520,672],[520,691],[539,83],[539,102],[539,121],[539,140],[539,159],[539,178],[539,197],[539,216],[539,235],[539,254],[539,273],[539,292],[539,311],[539,330],[539,349],[539,368],[539,387],[539,406],[539,425],[539,444],[539,463],[539,482],[539,501],[539,520],[539,539],[539,558],[539,577],[539,596],[539,615],[539,634],[539,653],[539,672],[539,691],[558,83],[558,102],[558,121],[558,140],[558,159],[558,178],[558,197],[558,216],[558,235],[558,254],[558,273],[558,292],[558,311],[558,330],[558,349],[558,368],[558,387],[558,406],[558,425],[558,444],[558,463],[558,482],[558,501],[558,520],[558,539],[558,558],[558,577],[558,596],[558,615],[558,634],[558,653],[558,672],[558,691],[577,83],[577,102],[577,121],[577,140],[577,159],[577,178],[577,197],[577,216],[577,235],[577,254],[577,273],[577,292],[577,311],[577,330],[577,349],[577,368],[577,387],[577,406],[577,425],[577,444],[577,463],[577,482],[577,501],[577,520],[577,539],[577,558],[577,577],[577,596],[577,615],[577,634],[577,653],[577,672],[577,691],[577,710],[596,83],[596,102],[596,121],[596,140],[596,159],[596,178],[596,197],[596,216],[596,235],[596,254],[596,273],[596,292],[596,311],[596,330],[596,349],[596,368],[596,387],[596,406],[596,425],[596,444],[596,463],[596,482],[596,501],[596,520],[596,539],[596,558],[596,577],[596,596],[596,615],[596,634],[596,653],[596,672],[596,691],[615,64],[615,83],[615,102],[615,121],[615,140],[615,159],[615,178],[615,197],[615,216],[615,235],[615,254],[615,273],[615,292],[615,311],[615,330],[615,349],[615,368],[615,387],[615,406],[615,425],[615,444],[615,463],[615,482],[615,501],[615,520],[615,539],[615,558],[615,577],[615,596],[615,615],[615,634],[615,653],[615,672],[634,64],[634,83],[634,102],[634,121],[634,140],[634,159],[634,178],[634,197],[634,216],[634,235],[634,254],[634,273],[634,292],[634,311],[634,330],[634,349],[634,368],[634,387],[634,406],[634,425],[634,444],[634,463],[634,482],[634,501],[634,520],[634,539],[634,558],[634,577],[634,596],[634,615],[634,634],[634,653],[634,672],[653,45],[653,64],[653,83],[653,102],[653,121],[653,140],[653,159],[653,178],[653,197],[653,216],[653,235],[653,254],[653,273],[653,292],[653,311],[653,330],[653,349],[653,368],[653,387],[653,406],[653,425],[653,444],[653,463],[653,482],[653,501],[653,520],[653,539],[653,558],[653,577],[653,596],[653,615],[653,634],[653,653],[672,45],[672,64],[672,83],[672,102],[672,121],[672,140],[672,159],[672,178],[672,197],[672,216],[672,235],[672,254],[672,273],[672,292],[672,311],[672,330],[672,349],[672,368],[672,387],[672,406],[672,425],[672,444],[672,463],[672,482],[672,501],[672,520],[672,539],[672,558],[672,577],[672,596],[672,615],[672,634],[672,653],[691,45],[691,64],[691,83],[691,102],[691,121],[691,140],[691,159],[691,178],[691,197],[691,216],[691,235],[691,254],[691,273],[691,292],[691,311],[691,330],[691,349],[691,368],[691,387],[691,406],[691,425],[691,444],[691,463],[691,482],[691,501],[691,520],[691,539],[691,558],[691,577],[691,596],[691,615],[691,634],[691,653],[710,45],[710,64],[710,83],[710,102],[710,121],[710,140],[710,159],[710,178],[710,197],[710,216],[710,235],[710,254],[710,273],[710,292],[710,311],[710,330],[710,349],[710,368],[710,387],[710,406],[710,425],[710,444],[710,463],[710,482],[710,501],[710,520],[710,539],[710,558],[710,577],[710,596],[710,615],[710,634],[729,45],[729,64],[729,83],[729,102],[729,121],[729,140],[729,159],[729,178],[729,197],[729,216],[729,235],[729,254],[729,273],[729,292],[729,311],[729,330],[729,349],[729,368],[729,387],[729,406],[729,425],[729,444],[729,463],[729,482],[729,501],[729,520],[729,539],[729,558],[729,577],[729,596],[729,615],[729,634],[748,83],[748,102],[748,121],[748,140],[748,159],[748,178],[748,197],[748,216],[748,235],[748,254],[748,273],[748,292],[748,311],[748,330],[748,349],[748,368],[748,387],[748,406],[748,425],[748,444],[748,463],[748,482],[748,501],[748,520],[748,539],[748,558],[748,577],[748,596],[748,615],[748,634],[767,102],[767,121],[767,140],[767,159],[767,178],[767,197],[767,216],[767,235],[767,254],[767,273],[767,292],[767,311],[767,330],[767,349],[767,368],[767,387],[767,406],[767,425],[767,444],[767,463],[767,482],[767,501],[767,520],[767,539],[767,558],[767,577],[767,596],[767,615],[767,634],[786,140],[786,159],[786,178],[786,197],[786,216],[786,235],[786,254],[786,273],[786,292],[786,311],[786,330],[786,349],[786,368],[786,387],[786,406],[786,425],[786,444],[786,463],[786,482],[786,501],[786,520],[786,539],[786,558],[786,577],[786,596],[786,615],[786,634],[786,653],[805,178],[805,197],[805,216],[805,235],[805,254],[805,273],[805,292],[805,311],[805,330],[805,349],[805,368],[805,387],[805,406],[805,425],[805,444],[805,463],[805,482],[805,501],[805,520],[805,539],[805,558],[805,577],[805,596],[805,615],[805,634],[805,653],[824,197],[824,216],[824,235],[824,254],[824,273],[824,292],[824,311],[824,330],[824,349],[824,368],[824,387],[824,406],[824,425],[824,444],[824,463],[824,482],[824,501],[824,520],[824,539],[824,558],[824,577],[824,596],[824,615],[824,634],[824,653],[824,672],[843,235],[843,254],[843,273],[843,292],[843,311],[843,330],[843,349],[843,368],[843,387],[843,406],[843,425],[843,444],[843,463],[843,482],[843,501],[843,520],[843,539],[843,558],[843,577],[843,596],[843,615],[843,634],[843,653],[843,672],[843,691],[862,425],[862,444],[862,463],[862,482],[862,501],[862,520],[862,539],[862,558],[862,577],[862,596],[862,615],[862,634],[862,653],[862,672],[862,691],[881,463],[881,482],[881,501],[881,520],[881,539],[881,558],[881,577],[881,596],[881,615],[881,634],[881,653],[881,672],[881,691],[900,463],[900,482],[900,501],[900,520],[900,539],[900,558],[900,577],[900,596],[900,615],[900,634],[900,653],[900,672],[900,691],[919,482],[919,501],[919,520],[919,539],[919,558],[919,577],[919,596],[938,463],[938,482],[938,501],[938,520],[957,463],[957,482],[957,501],[957,520],[976,463],[976,482],[976,501],[976,520],[995,463],[995,482],[995,501]];
const BORDER = "M287.6,77.2 L332.9,44.8 L397.9,61.5 L465.2,62.1 L514.0,99.0 L549.9,75.8 L627.4,61.3 L653.8,26.0 L698.1,26.0 L730.2,40.7 L762.7,85.5 L796.0,149.2 L856.6,239.1 L860.0,305.4 L848.9,369.9 L867.7,438.8 L914.6,466.7 L963.9,442.4 L1011.6,468.3 L1014.0,507.3 L963.1,539.8 L931.2,525.6 L901.8,707.9 L840.0,692.0 L763.6,637.1 L639.9,672.2 L587.8,710.8 L433.6,702.8 L352.9,679.3 L312.2,690.3 L282.0,628.2 L262.7,601.9 L287.1,576.4 L261.2,557.6 L228.2,591.4 L166.9,547.5 L158.7,485.2 L94.7,449.7 L82.9,401.6 L26.0,342.3 L110.2,313.8 L173.7,211.3 L223.4,108.9 L287.6,77.2Z";
const CITY_XY = [["Arad",140.7,333.3],["Zerind",162.2,267.5],["Oradea",204.4,199.5],["Sibiu",439.0,392.0],["Timisoara",129.8,399.5],["Lugoj",202.8,408.6],["Mehadia",251.5,527.7],["Drobeta",282.3,567.5],["Craiova",401.5,613.8],["Rimnicu",461.8,497.6],["Pitesti",514.0,534.3],["Fagaras",525.2,385.5],["Bucharest",643.9,599.2],["Giurgiu",629.9,678.2],["Urziceni",700.5,555.4],["Hirsova",837.5,559.6],["Eforie",911.6,654.8],["Vaslui",814.5,264.7],["Iasi",801.3,186.5],["Neamt",671.0,180.2]];

// ---------------------------------------------------------------------------
// Romania Route Finder — dotted-map dashboard.
// Cities are nodes, roads are edges. Pick From/To, and the optimal route
// (Uniform-Cost Search) draws itself across the map node-by-node; a floating
// card summarises the trip when the tour ends.
// UCS is exact; A* uses a straight-line demo heuristic for the comparison stat.
// ---------------------------------------------------------------------------

const LL = [[21.3123,46.1866],[21.5167,46.6222],[21.9189,47.0722],[24.152,45.7983],
[21.2087,45.7489],[21.9033,45.6886],[22.3667,44.9],[22.66,44.6369],[23.7949,44.3302],
[24.3692,45.0997],[24.8667,44.8565],[24.9731,45.8416],[26.1025,44.4268],[25.9699,43.9037],
[26.6414,44.7169],[27.9457,44.6892],[28.6519,44.0589],[27.7276,46.6407],[27.6014,47.1585],
[26.3611,47.2]];

const ROADS = [[0,1,75],[1,2,71],[2,3,151],[0,3,140],[0,4,118],[4,5,111],[5,6,70],[6,7,75],
[7,8,120],[8,9,146],[8,10,138],[3,9,80],[3,11,99],[9,10,97],[11,12,211],[10,12,101],
[12,13,90],[12,14,85],[14,15,98],[15,16,86],[14,17,142],[17,18,92],[18,19,87]];

const CITIES = CITY_XY.map(([name, x, y], i) => ({ name, x, y, lng: LL[i][0], lat: LL[i][1] }));
const NC = CITIES.length;
const ADJ = Array.from({ length: NC }, () => []);
for (const [a, b, d] of ROADS) { ADJ[a].push([b, d]); ADJ[b].push([a, d]); }

const KM = (i, j) => {
  const a = CITIES[i], b = CITIES[j];
  const mid = ((a.lat + b.lat) / 2) * Math.PI / 180;
  const dx = (a.lng - b.lng) * 111.32 * Math.cos(mid);
  const dy = (a.lat - b.lat) * 110.57;
  return Math.sqrt(dx * dx + dy * dy);
};

function search(start, goal, h) {
  const best = Array(NC).fill(Infinity), parent = Array(NC).fill(-1), settled = Array(NC).fill(false);
  let heap = [{ n: start, g: 0 }]; best[start] = 0;
  let generated = 1, peak = 1; const order = [];
  while (heap.length) {
    heap.sort((p, q) => p.g + h[p.n] - (q.g + h[q.n]));
    const { n, g } = heap.shift();
    if (settled[n]) continue;
    settled[n] = true; order.push(n);
    if (n === goal) {
      const path = []; let c = goal; while (c !== -1) { path.unshift(c); c = parent[c]; }
      return { path, cost: g, expanded: order.length, generated, peak, order };
    }
    for (const [nb, w] of ADJ[n]) {
      if (settled[nb]) continue;
      const ng = g + w;
      if (ng < best[nb]) { best[nb] = ng; parent[nb] = n; heap.push({ n: nb, g: ng }); generated++; }
    }
    peak = Math.max(peak, heap.filter((e) => !settled[e.n]).length);
  }
  return { path: [], cost: Infinity, expanded: order.length, generated, peak, order };
}

const C = {
  bg: "#0a0b10", panel: "#0e1017", panel2: "#0b0d13", line: "#1b1f2b",
  dot: "#2e5375", dotHi: "#6fb0e6",
  road: "#232838", route: "#5fa8e6", routeGlow: "#8fd0ff",
  nodeRing: "#38445e", start: "#5ee0d0", goal: "#ffffff", node: "#7cc4ff",
  text: "#e8edf6", muted: "#7d879c", accent: "#5b9fd4",
};
const FONT = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export default function App() {
  const [start, setStart] = useState(0);
  const [goal, setGoal] = useState(12);
  const [res, setRes] = useState(null);
  const [tour, setTour] = useState(0);       // how many hops of the path are revealed
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3);
  const [summary, setSummary] = useState(false);
  const [help, setHelp] = useState(false);

  const path = res ? res.path : [];
  const lastHop = Math.max(path.length - 1, 0);

  const run = () => {
    if (start === goal) return;
    const ucs = search(start, goal, Array(NC).fill(0));
    const astar = search(start, goal, CITIES.map((_, i) => KM(i, goal)));
    setRes({ ucs, astar, path: ucs.path, cost: ucs.cost });
    setTour(0); setSummary(false); setPlaying(true);
  };

  useEffect(() => { setRes(null); setPlaying(false); setTour(0); setSummary(false); }, [start, goal]);

  useEffect(() => {
    if (!playing || !res) return;
    if (tour >= lastHop) { setPlaying(false); setSummary(true); return; }
    const id = setTimeout(() => setTour((t) => t + 1), 850 / speed);
    return () => clearTimeout(id);
  }, [playing, tour, speed, res, lastHop]);

  // revealed route state
  const routeNodes = new Set(path.slice(0, tour + 1));
  const routeEdges = new Set();
  for (let i = 0; i < tour; i++) {
    const [a, b] = [path[i], path[i + 1]].sort((x, y) => x - y);
    routeEdges.add(a + "-" + b);
  }
  const current = res ? path[tour] : -1;

  // cumulative distance revealed
  let revealedKm = 0;
  for (let i = 0; i < tour; i++) {
    const e = ROADS.find(([a, b]) => (a === path[i] && b === path[i + 1]) || (b === path[i] && a === path[i + 1]));
    if (e) revealedKm += e[2];
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: C.bg, color: C.text, fontFamily: FONT, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes draw { from{stroke-dashoffset:var(--len)} to{stroke-dashoffset:0} }
        @keyframes pop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes rise { from{transform:translateY(12px);opacity:0} to{transform:translateY(0);opacity:1} }
        .rt-edge{ stroke-dasharray:var(--len); animation:draw .5s ease-out forwards; }
        .rt-node{ transform-box:fill-box; transform-origin:center; animation:pop .35s ease-out; }
        .blink{ animation:blink 1.4s ease-in-out infinite; }
        .rise{ animation:rise .35s ease-out; }
        select{ appearance:none; }
        input[type=range]{ accent-color:${C.accent}; }
        @media (prefers-reduced-motion: reduce){ .rt-edge,.rt-node,.blink,.rise{ animation:none; stroke-dashoffset:0 } }
      `}</style>

      {/* ===== MAP STAGE ===== */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 300 }}>
        <svg viewBox={`0 0 ${VB.w} ${VB.h}`} style={{ width: "100%", height: "100%", maxHeight: "100vh" }}>
          {/* halftone dots */}
          {DOTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.1} fill={C.dot} opacity={0.5} />)}
          {/* country outline */}
          <path d={BORDER} fill="none" stroke={C.line} strokeWidth={1} opacity={0.8} />

          {/* all roads (dim) */}
          {ROADS.map(([a, b], i) => (
            <line key={"r" + i} x1={CITIES[a].x} y1={CITIES[a].y} x2={CITIES[b].x} y2={CITIES[b].y}
              stroke={C.road} strokeWidth={1.2} />
          ))}
          {/* revealed route roads */}
          {ROADS.map(([a, b], i) => {
            const key = [a, b].sort((x, y) => x - y).join("-");
            if (!routeEdges.has(key)) return null;
            const len = Math.hypot(CITIES[a].x - CITIES[b].x, CITIES[a].y - CITIES[b].y);
            return (
              <g key={"rr" + i}>
                <line x1={CITIES[a].x} y1={CITIES[a].y} x2={CITIES[b].x} y2={CITIES[b].y}
                  stroke={C.routeGlow} strokeWidth={6} opacity={0.18} strokeLinecap="round" />
                <line className="rt-edge" style={{ "--len": len }}
                  x1={CITIES[a].x} y1={CITIES[a].y} x2={CITIES[b].x} y2={CITIES[b].y}
                  stroke={C.route} strokeWidth={2.6} strokeLinecap="round" />
              </g>
            );
          })}

          {/* nodes */}
          {CITIES.map((c, i) => {
            const onRoute = routeNodes.has(i);
            const isStart = i === start, isGoal = i === goal, isCur = i === current && res && !summary;
            const fill = isStart ? C.start : isGoal && (onRoute || !res) ? C.goal : onRoute ? C.node : "#0a0b10";
            const r = onRoute || isStart || isGoal ? 5.5 : 3.6;
            return (
              <g key={"n" + i}>
                {(isStart || isGoal) && <circle cx={c.x} cy={c.y} r={11} fill="none" stroke={isStart ? C.start : C.goal} strokeWidth={1} opacity={0.5} />}
                {isCur && <circle className="blink" cx={c.x} cy={c.y} r={9} fill="none" stroke={C.routeGlow} strokeWidth={1.5} />}
                <circle className={onRoute ? "rt-node" : ""} cx={c.x} cy={c.y} r={r}
                  fill={fill} stroke={onRoute || isStart || isGoal ? "#0a0b10" : C.nodeRing} strokeWidth={1.4} />
                <text x={c.x} y={c.y - 11} fontSize={11} textAnchor="middle" fontFamily={FONT}
                  fill={onRoute || isStart || isGoal ? C.text : C.muted}
                  opacity={onRoute || isStart || isGoal ? 1 : 0.55}
                  style={{ paintOrder: "stroke", stroke: C.bg, strokeWidth: 3, letterSpacing: 0.5 }}>
                  {c.name.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ===== LEFT SIDEBAR ===== */}
      <aside style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 300, background: C.panel, borderRight: `1px solid ${C.line}`, padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setHelp(true)} title="How to use"
            style={{ width: 34, height: 34, borderRadius: 8, background: C.panel2, border: `1px solid ${C.line}`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <HelpCircle size={18} />
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5 }}>ROMANIA</div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>ROUTE FINDER</div>
          </div>
        </div>

        {/* status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: 2, color: C.muted }}>
          <span className={playing ? "blink" : ""} style={{ width: 8, height: 8, borderRadius: 8, background: playing ? C.start : summary ? C.route : C.muted }} />
          {playing ? "TRACING" : summary ? "COMPLETE" : "IDLE"}
        </div>

        {/* big number */}
        <div>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
            {res ? (summary ? res.cost : revealedKm) : 0}<span style={{ fontSize: 15, color: C.muted, marginLeft: 6 }}>km</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginTop: 4 }}>DISTANCE TRAVELLED</div>
        </div>

        {/* transport */}
        <div style={{ display: "flex", gap: 8 }}>
          <IconBtn onClick={() => res && (tour >= lastHop ? (setTour(0), setSummary(false), setPlaying(true)) : setPlaying((p) => !p))} disabled={!res}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </IconBtn>
          <IconBtn onClick={() => { setPlaying(false); setTour((t) => Math.min(t + 1, lastHop)); }} disabled={!res}><SkipForward size={16} /></IconBtn>
          <IconBtn onClick={() => { setPlaying(false); setTour(0); setSummary(false); }} disabled={!res}><RotateCcw size={16} /></IconBtn>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 4 }}><span>SPEED</span><span>{speed}×</span></div>
          <input type="range" min={1} max={6} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: "100%" }} />
        </div>

        {/* revealed list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 8 }}>ROUTE</div>
          {res ? path.slice(0, tour + 1).map((n, i) => (
            <div key={i} className="rise" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 12, color: i === tour && !summary ? C.start : C.text }}>
              <MapPin size={12} color={i === 0 ? C.start : i === path.length - 1 ? C.goal : C.route} />
              {CITIES[n].name}
              <span style={{ marginLeft: "auto", color: C.muted, fontSize: 11 }}>{i === 0 ? "start" : "→"}</span>
            </div>
          )) : <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Pick a start and destination, then press Find route.</div>}
        </div>

        {/* legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: 10, color: C.muted, letterSpacing: 1 }}>
          <Leg c={C.start} t="START" /><Leg c={C.goal} t="GOAL" /><Leg c={C.route} t="ROUTE" /><Leg c={C.dot} t="TERRAIN" />
        </div>
      </aside>

      {/* ===== TOP-RIGHT: FROM / TO CARD ===== */}
      <div style={{ position: "absolute", top: 20, right: 20, width: 340, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, boxShadow: "0 10px 40px rgba(0,0,0,.5)" }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Search size={12} /> PLAN A ROUTE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Picker label="FROM" value={start} onChange={setStart} exclude={goal} accent={C.start} />
          <ArrowRight size={16} color={C.muted} style={{ marginTop: 14, flexShrink: 0 }} />
          <Picker label="TO" value={goal} onChange={setGoal} exclude={start} accent={C.goal} />
        </div>
        <button onClick={run} disabled={start === goal}
          style={{ width: "100%", marginTop: 12, padding: "10px 0", borderRadius: 8, border: "none", cursor: start === goal ? "not-allowed" : "pointer", background: start === goal ? C.line : C.accent, color: start === goal ? C.muted : "#04121f", fontFamily: FONT, fontWeight: 700, letterSpacing: 1, fontSize: 13 }}>
          FIND ROUTE
        </button>
      </div>

      {/* ===== FLOATING SUMMARY CARD ===== */}
      {summary && res && (
        <div className="rise" style={{ position: "absolute", left: "50%", bottom: 28, transform: "translateX(-50%)", marginLeft: 150, width: 560, maxWidth: "70vw", background: C.panel, border: `1px solid ${C.route}`, borderRadius: 14, padding: 20, boxShadow: "0 16px 50px rgba(0,0,0,.6)" }}>
          <button onClick={() => setSummary(false)} style={{ position: "absolute", top: 12, right: 12, background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={16} /></button>
          <div style={{ fontSize: 10, letterSpacing: 3, color: C.route }}>ROUTE FOUND · UNIFORM-COST SEARCH</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, margin: "6px 0 14px" }}>
            <div style={{ fontSize: 40, fontWeight: 700 }}>{res.cost}<span style={{ fontSize: 15, color: C.muted }}> km</span></div>
            <div style={{ fontSize: 12, color: C.muted }}>{CITIES[start].name} → {CITIES[goal].name}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {res.path.map((n, i) => (
              <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.text }}>
                {CITIES[n].name}{i < res.path.length - 1 ? "  →" : ""}
              </span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            <Stat label="CITIES" v={res.path.length} />
            <Stat label="ROADS" v={res.path.length - 1} />
            <Stat label="UCS EXPANDED" v={res.ucs.expanded} />
            <Stat label="A* EXPANDED" v={res.astar.expanded} accent />
          </div>
          <div style={{ fontSize: 10.5, color: C.muted, marginTop: 12, lineHeight: 1.5 }}>
            A* reached the goal after expanding {res.astar.expanded} cities vs UCS's {res.ucs.expanded} — the heuristic prunes the search, but both return the same optimal {res.cost} km route.
          </div>
        </div>
      )}

      {/* ===== HELP MODAL ===== */}
      {help && (
        <div onClick={() => setHelp(false)} style={{ position: "absolute", inset: 0, background: "rgba(4,5,9,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: "88vw", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2 }}>HOW TO USE</div>
              <button onClick={() => setHelp(false)} style={{ background: "transparent", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
            </div>
            {[
              ["1", "Pick From and To", "Use the card at the top right to choose a starting city and a destination."],
              ["2", "Find route", "Press FIND ROUTE. The cheapest road route is computed with Uniform-Cost Search."],
              ["3", "Watch it draw", "The route lights up city by city from start to destination across the map."],
              ["4", "Read the summary", "A card shows total distance, the cities passed, and how UCS compares to A*."],
              ["5", "Replay", "Use play / step / reset and the speed slider in the left panel to control playback."],
            ].map(([n, t, d]) => (
              <div key={n} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 6, background: C.panel2, border: `1px solid ${C.line}`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} style={{ flex: 1, padding: "9px 0", borderRadius: 8, background: C.panel2, border: `1px solid ${C.line}`, color: C.text, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", justifyContent: "center" }}>{children}</button>;
}
function Picker({ label, value, onChange, exclude, accent }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: accent, letterSpacing: 2, marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", background: C.panel2, color: C.text, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontFamily: FONT, fontSize: 13, cursor: "pointer" }}>
        {CITIES.map((c, i) => <option key={i} value={i} disabled={i === exclude} style={{ background: C.panel }}>{c.name}</option>)}
      </select>
    </label>
  );
}
function Stat({ label, v, accent }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ? C.route : C.text }}>{v}</div>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Leg({ c, t }) {
  return <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: c }} />{t}</span>;
}
