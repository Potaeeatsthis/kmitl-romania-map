// components/circuit/CircuitLegend.test.tsx
import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { romaniaGraph } from "../../lib/romaniaGraph";
import type { ConductanceEdge } from "../../lib/types";
import CircuitLegend from "./CircuitLegend";
import CircuitMap, { type CircuitMarker } from "./CircuitMap";
import styles from "./CircuitMap.module.css";

const edges: ConductanceEdge[] = romaniaGraph.roads.map(([a, b, distance]) => ({
  city_a: a,
  city_b: b,
  distance,
  conductance: 1 / distance,
}));

const potential: Record<number, number> = {};
romaniaGraph.cities.forEach((city, index) => {
  potential[city.id] = Math.max(0, (20 - index) * 3.17);
});

const markers: CircuitMarker[] = [
  { cityId: 0, role: "focus" },
  { cityId: 1, role: "chosen" },
  { cityId: 2, role: "considered" },
];

describe("CircuitLegend", () => {
  it("splits the outline channel from the voltage channel", () => {
    render(<CircuitLegend variant="terminal" />);
    expect(screen.getByText("Circle outline = what A* is doing")).toBeInTheDocument();
    expect(screen.getByText("Circle color = voltage")).toBeInTheDocument();
    expect(screen.getByText("This city")).toBeInTheDocument();
    expect(screen.getByText("Checked next")).toBeInTheDocument();
    expect(screen.getByText("Other waiting cities")).toBeInTheDocument();
    expect(screen.getByText("Lower voltage")).toBeInTheDocument();
    expect(screen.getByText("Higher voltage")).toBeInTheDocument();
    expect(screen.getByText(/does not change with A\* status/)).toBeInTheDocument();
  });

  it("gives the overview its own start, destination and final-route key", () => {
    render(<CircuitLegend variant="overview" />);
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Destination (ground)")).toBeInTheDocument();
    expect(screen.getByText("On the final route")).toBeInTheDocument();
    expect(screen.getByText("Final route")).toBeInTheDocument();
    expect(screen.getByText("Circle color = voltage")).toBeInTheDocument();
  });

  it("renders every outline sample with the exact classes the map uses", () => {
    const { container: map } = render(
      <CircuitMap viewBox="0 0 900 650" edges={edges} potential={potential} markers={markers} />,
    );
    const { container: legend } = render(<CircuitLegend variant="terminal" />);

    for (const role of ["focus", "chosen", "considered"] as const) {
      const roleClass = styles[`node_${role}`];
      const mapNode = map.querySelector(`g[class*="${roleClass}"]`);
      const legendNode = legend.querySelector(`g[class*="${roleClass}"]`);
      expect(mapNode, `map ${role}`).not.toBeNull();
      expect(legendNode, `legend ${role}`).not.toBeNull();
      expect(mapNode!.querySelector(`circle[class*="${styles.nodeCircle}"]`)).not.toBeNull();
      expect(legendNode!.querySelector(`circle[class*="${styles.nodeCircle}"]`)).not.toBeNull();
      // The outline sample is deliberately flat so only the outline reads.
      expect(legendNode!.getAttribute("class")).toContain(styles.nodeNeutral);
    }
  });

  it("gives the overview's final-route swatch its own green, not the global theme's", () => {
    const css = readFileSync(
      path.join(process.cwd(), "components/circuit/CircuitMap.module.css"),
      "utf8",
    );
    const body = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
      const open = css.indexOf("{", start);
      return css.slice(open + 1, css.indexOf("}", open));
    };

    // The palette rule the map and the legend both read must carry the hot
    // wire's green. If it does not, the legend falls back to the global
    // --green-mid (dark: #eee) while the map keeps its own #3fd98a.
    const shared = body(".svg,\n.legend");
    expect(shared).toMatch(/--green-mid:\s*#00684a/);
    expect(shared).toMatch(/--green-bright:\s*#00ed64/);
    expect(shared).toMatch(/--green-dark:\s*#0b5631/);

    const dark = body(':global(html[data-theme="dark"]) .legend');
    expect(dark).toMatch(/--green-mid:\s*#3fd98a/);
    expect(dark).toMatch(/--green-bright:\s*#00ed64/);
    expect(dark).toMatch(/--green-dark:\s*#00ed64/);

    // The map wire and the legend swatch consume the same token.
    expect(body(".edge_hot .wireLine")).toContain("var(--green-mid)");
  });

  it("separates the three A* roles by dash and width, not colour alone", () => {
    const css = readFileSync(
      path.join(process.cwd(), "components/circuit/CircuitMap.module.css"),
      "utf8",
    );
    const body = (selector: string) => {
      const start = css.indexOf(selector);
      expect(start, `missing ${selector}`).toBeGreaterThanOrEqual(0);
      const open = css.indexOf("{", start);
      return css.slice(open + 1, css.indexOf("}", open));
    };
    const focus = body(".node_focus .nodeCircle");
    const chosen = body(".node_chosen .nodeCircle");
    const considered = body(".node_considered .nodeCircle");

    // Focus is the only solid ring; chosen and considered dash differently.
    expect(focus).not.toContain("dasharray");
    const chosenDash = chosen.match(/dasharray:\s*([^;]+)/)?.[1]?.trim();
    const consideredDash = considered.match(/dasharray:\s*([^;]+)/)?.[1]?.trim();
    expect(chosenDash).toBeTruthy();
    expect(consideredDash).toBeTruthy();
    expect(chosenDash).not.toBe(consideredDash);
    // "Checked next" is the next ring, not the amber waiting colour.
    expect(chosen).toContain("var(--next-ring)");
    expect(considered).toContain("var(--considered-line)");
  });
});
