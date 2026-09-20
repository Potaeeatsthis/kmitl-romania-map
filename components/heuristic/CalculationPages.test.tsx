import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CircuitFlowPage from "../../app/circuit-flow/page";
import KirchhoffMatrixPage from "../../app/kirchhoff-matrix/page";
import HeuristicStepsPage from "../../app/heuristic-steps/page";
import { romaniaGraph } from "../../lib/romaniaGraph";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";
import type { HeuristicExplanation } from "../../lib/types";

const navigation = vi.hoisted(() => ({ query: "start=0&goal=2" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("../../lib/wasm/client", () => ({ explainCurrentFlow: vi.fn(),runSearch: vi.fn(), }));

// A small, exactly solvable circuit: 0--1--2, each road has resistance 1.
const circuit: HeuristicExplanation = {
  start: 0, goal: 2,
  conductances: [
    { city_a: 0, city_b: 1, distance: 1, conductance: 1 },
    { city_a: 1, city_b: 2, distance: 1, conductance: 1 },
  ],
  laplacian: [[1, -1, 0], [-1, 2, -1], [0, -1, 1]],
  steps: [
    { pivot_column: 0, pivot_row: 0, matrix_after: [[1, -1, 1, 0], [0, 1, 1, 1]] },
    { pivot_column: 1, pivot_row: 1, matrix_after: [[1, 0, 2, 1], [0, 1, 1, 1]] },
  ],
  effective_resistance: 2,
};

// Four cities in a line, 0--1--2--3, each road resistance 1. Goal 0 is grounded
// and removed, so the grounded order is [1, 2, 3] and start 3 lands at index 2.
// The inverse of the grounded matrix is [[1,1,1],[1,2,2],[1,2,3]], so the
// source diagonal R_eff(Sibiu, Arad) is 3.
const goalRemoved: HeuristicExplanation = {
  start: 3, goal: 0,
  conductances: [
    { city_a: 0, city_b: 1, distance: 1, conductance: 1 },
    { city_a: 1, city_b: 2, distance: 1, conductance: 1 },
    { city_a: 2, city_b: 3, distance: 1, conductance: 1 },
  ],
  laplacian: [
    [1, -1, 0, 0],
    [-1, 2, -1, 0],
    [0, -1, 2, -1],
    [0, 0, -1, 1],
  ],
  steps: [
    { pivot_column: 0, pivot_row: 0, matrix_after: [
      [1, 0, 0, 1, 1, 1],
      [0, 1, 0, 1, 2, 2],
      [0, 0, 1, 1, 2, 3],
    ] },
  ],
  effective_resistance: 3,
};

// A full 20-city explanation so the real Sibiu (3) / Bucharest (12) ids can be
// used end to end. The numbers are arbitrary; the round-trip tests only read the
// labels and links the pages derive from the query context.
function wideExplanation(start: number, goal: number, resistance: number): HeuristicExplanation {
  const cityCount = romaniaGraph.cities.length;
  const size = cityCount - 1;
  const finalMatrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size * 2 }, (_, column) => (column === row || column === size + row ? 1 : 0)),
  );
  return {
    start, goal,
    conductances: [],
    laplacian: Array.from({ length: cityCount }, (_, row) =>
      Array.from({ length: cityCount }, (_, column) => (row === column ? 1 : 0)),
    ),
    steps: [{ pivot_column: 0, pivot_row: 0, matrix_after: finalMatrix }],
    effective_resistance: resistance,
  };
}

// Edges 0-1, 0-2, 1-3, 2-3. A* expands 0, then 1, then 2 (no road 1-2), then 3.
// The route is 0-1-3, so the frontier after expanding 1 contains 2, which is
// not a neighbour of 1. The grounded solution puts V(1) = V(3) = 0, so road
// 1-3 carries no current.
const branching: HeuristicExplanation = {
  start: 0,
  goal: 3,
  conductances: [
    { city_a: 0, city_b: 1, distance: 1, conductance: 1 },
    { city_a: 0, city_b: 2, distance: 1, conductance: 1 },
    { city_a: 1, city_b: 3, distance: 1, conductance: 1 },
    { city_a: 2, city_b: 3, distance: 1, conductance: 1 },
  ],
  laplacian: [
    [2, -1, -1, 0],
    [-1, 2, 0, -1],
    [-1, 0, 2, -1],
    [0, -1, -1, 2],
  ],
  steps: [
    {
      pivot_column: 0,
      pivot_row: 0,
      matrix_after: [
        [1, 0, 0, 1, 0, 0],
        [0, 1, 0, 0, 1, 0],
        [0, 0, 1, 0, 0, 1],
      ],
    },
  ],
  effective_resistance: 1,
};

const branchingSearch = {
  ucs: {
    path: [0, 1, 3],
    explored_order: [0, 1, 2, 3],
    trace: [],
    cost: 2,
    expanded: 0,
    generated: 0,
    peak_frontier: 0,
    peak_records: 0,
    peak_payload_bytes: 0,
  },
  astar: {
    path: [0, 1, 3],
    explored_order: [0, 1, 2, 3],
    trace: [
      { expanded_city: 0, expanded_cost: 0, frontier: [{ city: 1, cost: 1, priority: 1 }, { city: 2, cost: 1, priority: 2 }], discovered: [] },
      { expanded_city: 1, expanded_cost: 1, frontier: [{ city: 2, cost: 1, priority: 1.5 }, { city: 3, cost: 2, priority: 2.5 }], discovered: [] },
      { expanded_city: 2, expanded_cost: 1, frontier: [{ city: 3, cost: 2, priority: 2.5 }], discovered: [] },
      { expanded_city: 3, expanded_cost: 2, frontier: [], discovered: [] },
    ],
    cost: 2,
    expanded: 4,
    generated: 4,
    peak_frontier: 2,
    peak_records: 4,
    peak_payload_bytes: 0,
  },
};

beforeEach(() => {
  navigation.query = "start=0&goal=2";
  vi.mocked(explainCurrentFlow).mockReset().mockResolvedValue(circuit);
  // CircuitFlowPage fetches its own A* trace independently of explainCurrentFlow;
  // give it a generic, always-valid response keyed off whatever start/goal it's
  // called with, so tests that don't care about per-terminal detail never trip
  // the page's error boundary on an unresolved mock.
  vi.mocked(runSearch).mockReset().mockImplementation(async (start: number, goal: number) => ({
    ucs: {
      path: [start, goal],
      explored_order: [start],
      trace: [],
      cost: 0,
      expanded: 0,
      generated: 0,
      peak_frontier: 0,
      peak_records: 0,
      peak_payload_bytes: 0,
    },
    astar: {
      path: [start, goal],
      explored_order: [start],
      trace: [{ expanded_city: start, expanded_cost: 0, frontier: [], discovered: [] }],
      cost: 0,
      expanded: 1,
      generated: 1,
      peak_frontier: 1,
      peak_records: 1,
      peak_payload_bytes: 0,
    },
  }));
});

describe("calculation teaching pages", () => {
  it("walks through pivots and connects the inverse diagonal to the heuristic", async () => {
    const user = userEvent.setup();
    render(<HeuristicStepsPage />);
    expect(await screen.findByRole("heading", { name: "What happens in pivot 1?" })).toBeInTheDocument();
    expect(screen.getByRole("math", { name: "Pivot 1 formulas" })).toHaveTextContent("R1 ← R1 ÷ 1.00000");
    expect(screen.getByRole("button", { name: "← Previous pivot" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next pivot →" }));
    expect(screen.getByRole("heading", { name: "What happens in pivot 2?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next pivot →" })).toBeDisabled();
    expect(within(screen.getByRole("region", { name: "Inverse complete" })).getByText("2.0000 Ω")).toBeInTheDocument();
    await user.click(screen.getByText(/Inspect the full augmented matrix/));
    await user.click(screen.getByRole("button", { name: "Before this pivot" }));
    expect(screen.getByRole("table", { name: /Before Gauss-Jordan pivot 2/ })).toBeInTheDocument();
    expect(screen.getByText(/Other entries in this column are voltages/)).toBeInTheDocument();
  });

  it("focuses conductances and matrix rows on the selected pair", async () => {
    const user = userEvent.setup();
    render(<KirchhoffMatrixPage />);
    const roads = await screen.findByRole("table", { name: "Roads connected to Arad and Oradea" });
    expect(within(roads).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("math", { name: "Conductance formulas" })).toHaveTextContent("cArad,Zerind = 1 ÷ 1 = 1.000000");
    expect(screen.getByRole("math", { name: "Kirchhoff matrix formulas" })).toHaveTextContent("Kii = Σj cij");
    expect(within(screen.getByRole("table", { name: "Kirchhoff rows for Arad and Oradea" })).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText(/Show the full grounded matrix/).closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByText(/Show the full grounded matrix/));
    expect(screen.getByRole("table", { name: /Full grounded Kirchhoff matrix excluding Oradea/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Matrix elimination/ })).toHaveAttribute("href", "/heuristic-steps?start=0&goal=2");
  });

  it("preserves the original A* decision through the numbered steps", async () => {
    navigation.query = "start=0&goal=2&routeStart=1&decision=3";
    render(<KirchhoffMatrixPage />);
    await screen.findByRole("heading", {name: "Highlighted Kirchhoff rows"});
    expect(screen.getByRole("link", {name: "Back to this A* decision"})).toHaveAttribute("href", "/heuristic-summary?start=1&goal=2&explained=0&decision=3#decision-3");
    const active = screen.getByRole("link", {name: "Kirchhoff matrix"});
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2&routeStart=1&decision=3");
    expect(explainCurrentFlow).toHaveBeenCalledWith(0, 2);
  });

  it("round-trips the explained city through every calculation page", async () => {
    navigation.query = "start=3&goal=12&routeStart=0&decision=0";
    vi.mocked(explainCurrentFlow).mockResolvedValue(wideExplanation(3, 12, 133.74));
    const expectedStepper = {
      "Circuit view": "/circuit-flow?start=3&goal=12&routeStart=0&decision=0",
      "Kirchhoff matrix": "/kirchhoff-matrix?start=3&goal=12&routeStart=0&decision=0",
      "Matrix elimination": "/heuristic-steps?start=3&goal=12&routeStart=0&decision=0",
    };
    const pages = [CircuitFlowPage, KirchhoffMatrixPage, HeuristicStepsPage];
    for (const Page of pages) {
      const { unmount } = render(<Page />);
      // One shared result card names the h being calculated; the overall A*
      // route is separate, secondary context.
      expect(await screen.findByRole("heading", { name: "h(Sibiu → Bucharest) = 133.74" })).toBeInTheDocument();
      expect(screen.getByText(/Overall route: Arad → Bucharest/)).toBeInTheDocument();
      // The back link keeps Sibiu (explained=3) and the decision so the summary
      // can reopen the same calculation instead of Arad's.
      expect(screen.getByRole("link", { name: "Back to this A* decision" })).toHaveAttribute(
        "href",
        "/heuristic-summary?start=0&goal=12&explained=3&decision=0#decision-0",
      );
      for (const [label, href] of Object.entries(expectedStepper)) {
        expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
      }
      unmount();
    }
  });

  it("keeps the A* route context on the circuit view's elimination link", async () => {
    navigation.query = "start=3&goal=12&routeStart=0&decision=0";
    vi.mocked(explainCurrentFlow).mockResolvedValue(wideExplanation(3, 12, 133.74));
    const { unmount } = render(<CircuitFlowPage />);
    expect(
      await screen.findByRole("link", { name: /Watch every pivot happen/ }),
    ).toHaveAttribute("href", "/heuristic-steps?start=3&goal=12&routeStart=0&decision=0");
    unmount();

    // An invalid routeStart is not context, so only the explained pair survives.
    navigation.query = "start=3&goal=12&routeStart=99&decision=0";
    const invalid = render(<CircuitFlowPage />);
    expect(
      await screen.findByRole("link", { name: /Watch every pivot happen/ }),
    ).toHaveAttribute("href", "/heuristic-steps?start=3&goal=12");
    invalid.unmount();

    // No context at all still links the explained pair.
    navigation.query = "start=3&goal=12";
    render(<CircuitFlowPage />);
    expect(
      await screen.findByRole("link", { name: /Watch every pivot happen/ }),
    ).toHaveAttribute("href", "/heuristic-steps?start=3&goal=12");
  });

  it("drops invalid route context and keeps the explained city", async () => {
    navigation.query = "start=3&goal=12&routeStart=99&decision=0";
    vi.mocked(explainCurrentFlow).mockResolvedValue(wideExplanation(3, 12, 133.74));
    render(<KirchhoffMatrixPage />);
    expect(await screen.findByRole("heading", { name: "h(Sibiu → Bucharest) = 133.74" })).toBeInTheDocument();
    // Invalid routeStart is not context: no overall route line, and the stepper
    // still carries the explained city so the calculation is not lost.
    expect(screen.queryByText(/Overall route:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to A* decisions" })).toHaveAttribute("href", "/heuristic-summary?start=3&goal=12");
    expect(screen.getByRole("link", { name: "Circuit view" })).toHaveAttribute("href", "/circuit-flow?start=3&goal=12");
  });

  it("presents the selected h(n) once with the overall route as separate context", async () => {
    navigation.query = "start=3&goal=12&routeStart=0&decision=0";
    vi.mocked(explainCurrentFlow).mockResolvedValue(wideExplanation(3, 12, 133.74));
    render(<KirchhoffMatrixPage />);
    const selected = await screen.findByRole("region", { name: "Selected heuristic value" });
    // The pair and its value appear together, once, as the card heading.
    expect(within(selected).getByRole("heading", { name: "h(Sibiu → Bucharest) = 133.74" })).toBeInTheDocument();
    expect(within(selected).getAllByText(/Sibiu → Bucharest/)).toHaveLength(1);
    // The overall route is supporting context beside the selected pair.
    expect(within(selected).getByText(/Overall route: Arad → Bucharest/)).toBeInTheDocument();
    expect(within(selected).getByRole("link", { name: "See how 133.74 is calculated →" })).toHaveAttribute(
      "href",
      "/heuristic-steps?start=3&goal=12&routeStart=0&decision=0&view=result",
    );
    expect(within(selected).getByRole("link", { name: "Back to this A* decision" })).toHaveAttribute(
      "href",
      "/heuristic-summary?start=0&goal=12&explained=3&decision=0#decision-0",
    );
  });

  it("omits the recalculation link on the elimination page", async () => {
    render(<HeuristicStepsPage />);
    const selected = await screen.findByRole("region", { name: "Selected heuristic value" });
    expect(within(selected).getByRole("heading", { name: "h(Arad → Oradea) = 2.00" })).toBeInTheDocument();
    // Already on the elimination page: there is nowhere further to recalculate.
    expect(within(selected).queryByRole("link", { name: /See how/ })).not.toBeInTheDocument();
  });

  it("shows a safe zero-current circuit for the destination itself", async () => {
    navigation.query = "start=2&goal=2";
    vi.mocked(explainCurrentFlow).mockResolvedValue({ ...circuit, start: 2, effective_resistance: 0, steps: [] });
    render(<CircuitFlowPage />);
    expect(await screen.findByText(/No current is injected/)).toBeInTheDocument();
    expect(screen.getByRole("math", { name: "Road cost, conductance, and current formulas" })).toHaveTextContent("= 1 ÷ R = 1 ÷ 1 = 1.000000");
    expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("aria-current", "page");
    // Start equals goal: there is no queue and no road to invent.
    expect(screen.queryByText(/next expanded/)).not.toBeInTheDocument();
  });

  it("does not draw a road when A* expands a non-adjacent frontier city next", async () => {
    navigation.query = "start=0&goal=3";
    vi.mocked(explainCurrentFlow).mockResolvedValue(branching);
    vi.mocked(runSearch).mockResolvedValue(branchingSearch);

    render(<CircuitFlowPage />);

    expect(await screen.findByText(/no direct road from here/)).toBeInTheDocument();
    expect(screen.queryByText(/next hop/)).not.toBeInTheDocument();
    // The overview and the terminal-0 crop may highlight real roads (0-1, 1-3),
    // but the non-adjacent 1-2 pair must never get a hot edge.
    expect(document.querySelector("#circuit-edge-1-2-hot")).toBeNull();
    expect(document.querySelector("#circuit-edge-0-1-hot")).not.toBeNull();
  });

  it("labels a zero-current road as no flow in the KCL terms", async () => {
    navigation.query = "start=0&goal=3";
    vi.mocked(explainCurrentFlow).mockResolvedValue(branching);
    vi.mocked(runSearch).mockResolvedValue(branchingSearch);

    render(<CircuitFlowPage />);

    // Road 1-3 has equal endpoint potentials (both at ground), so its KCL term
    // must say no flow rather than print a direction arrow with 0.000A.
    expect(await screen.findByText("No current flows on this road")).toBeInTheDocument();
    expect(screen.queryByText(/0\.000A out/)).not.toBeInTheDocument();
  });

  it("links the highlighted heuristic to the highlighted final inverse entry", async () => {
    const user = userEvent.setup();
    navigation.query = "start=0&goal=2&routeStart=1&decision=3";
    const { unmount } = render(<KirchhoffMatrixPage />);
    const link = await screen.findByRole("link", {name: "See how 2.00 is calculated →"});
    expect(screen.getByRole("region", {name: "Selected heuristic value"}).querySelector("mark")).toHaveTextContent("2.00");
    expect(link).toHaveAttribute("href", "/heuristic-steps?start=0&goal=2&routeStart=1&decision=3&view=result");
    navigation.query = link.getAttribute("href")!.split("?")[1];
    unmount();
    render(<HeuristicStepsPage />);
    const answer = await screen.findByRole("cell", {name: "Selected h(Arad → Oradea): 2.00"});
    expect(answer.querySelector("mark")).toHaveTextContent("2.00");
    expect(answer.closest("details")).toHaveAttribute("open");
    expect(screen.getByRole("button", {name: "Next pivot →"})).toBeDisabled();
    await user.click(screen.getByRole("button", {name: "← Previous pivot"}));
    expect(screen.queryByRole("cell", {name: /Selected h/})).not.toBeInTheDocument();
  });

  it("labels the elimination matrix by grounded city and highlights the source diagonal", async () => {
    navigation.query = "start=3&goal=0&view=result";
    vi.mocked(explainCurrentFlow).mockResolvedValue(goalRemoved);
    render(<HeuristicStepsPage />);
    const matrix = await screen.findByRole("table", { name: /After Gauss-Jordan pivot 1/ });
    // Rows read city-first with the equation position secondary, mapped through
    // the grounded order, so the removed goal Arad never appears.
    expect(within(matrix).getAllByRole("rowheader").map((cell) => cell.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "Zerind (r1)",
      "Oradea (r2)",
      "Sibiu (r3)",
    ]);
    expect(within(matrix).getAllByRole("columnheader", { name: "Sibiu" })).toHaveLength(2);
    expect(within(matrix).queryByRole("columnheader", { name: "Arad" })).not.toBeInTheDocument();
    // Source Sibiu is grounded index 2, not raw id 3: the answer is the row 2 /
    // right-half column 2 diagonal entry, and only that cell is highlighted.
    const answer = within(matrix).getByRole("cell", { name: "Selected h(Sibiu → Arad): 3.00" });
    expect(answer.querySelector("mark")).toHaveTextContent("3.00");
    expect(answer.closest("tr")).toHaveTextContent("Sibiu (r3)");
    expect(answer.closest("tr")).not.toHaveTextContent("Oradea (r2)");
  });

  it("highlights the source diagonal only after the final pivot", async () => {
    const user = userEvent.setup();
    render(<HeuristicStepsPage />);
    await screen.findByRole("heading", { name: "What happens in pivot 1?" });
    await user.click(screen.getByText(/Inspect the full augmented matrix/));
    expect(screen.queryByRole("cell", { name: /Selected h/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next pivot →" }));
    expect(screen.getByRole("cell", { name: "Selected h(Arad → Oradea): 2.00" }).querySelector("mark")).toHaveTextContent("2.00");
    await user.click(screen.getByRole("button", { name: "Before this pivot" }));
    expect(screen.queryByRole("cell", { name: /Selected h/ })).not.toBeInTheDocument();
  });

  it("handles invalid routes and failed calculations", async () => {
    navigation.query = "start=&goal=2";
    const { unmount } = render(<KirchhoffMatrixPage />);
    expect(screen.getByText(/Choose a starting point/)).toBeInTheDocument();
    expect(explainCurrentFlow).not.toHaveBeenCalled();
    unmount();
    navigation.query = "start=0&goal=2";
    vi.mocked(explainCurrentFlow).mockRejectedValue(new Error("Unavailable"));
    render(<HeuristicStepsPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  });

  it("explains zero resistance when start equals goal", async () => {
    navigation.query = "start=2&goal=2";
    vi.mocked(explainCurrentFlow).mockResolvedValue({ ...circuit, start: 2, effective_resistance: 0 });
    render(<HeuristicStepsPage />);
    expect(await screen.findByText(/No current is needed, so h/)).toHaveTextContent("h(Oradea) = 0");
    // Source equals goal: there is no inverse diagonal cell to highlight.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("cell", { name: /Selected h/ })).not.toBeInTheDocument();
  });

  it("turns a view-model failure into an alert instead of an uncaught render error", async () => {
    navigation.query = "start=0&goal=2";
    // A ragged Laplacian reaches buildGroundedKirchhoffSystem, which throws while
    // the page is rendering. The boundary must surface the existing alert.
    vi.mocked(explainCurrentFlow).mockResolvedValue({ ...circuit, laplacian: [[1, -1, 0]] });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<KirchhoffMatrixPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not calculate: The Kirchhoff matrix must be a finite square matrix.",
    );
    consoleError.mockRestore();
  });
});
