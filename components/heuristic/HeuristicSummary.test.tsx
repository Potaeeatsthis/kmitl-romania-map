import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HeuristicSummaryPage from "../../app/heuristic-summary/page";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("start=0&goal=2") }));
vi.mock("../../lib/wasm/client", () => ({ explainCurrentFlow: vi.fn(), runSearch: vi.fn() }));

beforeEach(() => {
  vi.mocked(explainCurrentFlow).mockResolvedValue({
    start: 0, goal: 2,
    conductances: [{ city_a: 0, city_b: 1, distance: 1, conductance: 1 }, { city_a: 1, city_b: 2, distance: 1, conductance: 1 }],
    laplacian: [[1,-1,0],[-1,2,-1],[0,-1,1]],
    steps: [{ pivot_column: 1, pivot_row: 1, matrix_after: [[1,0,2,1],[0,1,1,1]] }],
    effective_resistance: 2,
  });
  const result = {
    path: [0,1,2], explored_order: [0,1,2], cost: 2, expanded: 3, generated: 3,
    peak_frontier: 1, peak_records: 3, peak_payload_bytes: 0,
    trace: [
      { expanded_city: 0, expanded_cost: 0, frontier: [{city: 1, cost: 1, priority: 2}], discovered: [] },
      { expanded_city: 1, expanded_cost: 1, frontier: [{city: 2, cost: 2, priority: 2}], discovered: [] },
      { expanded_city: 2, expanded_cost: 2, frontier: [], discovered: [] },
    ],
  };
  vi.mocked(runSearch).mockResolvedValue({astar: result, ucs: result});
});

it("links each queue heuristic to its own city and retains the original decision", async () => {
  render(<HeuristicSummaryPage />);
  const queue = await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(within(queue).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["City", "g", "h", "f", "Decision"]);
  expect(within(queue).getByRole("link", {name: "Show how h(Zerind) is calculated"})).toHaveAttribute("href", "/kirchhoff-matrix?start=1&goal=2&routeStart=0&decision=0");
  const firstDecision = screen.getByRole("math", {name: "Priority formula for Zerind"}).closest("article")!;
  expect(within(firstDecision).getByRole("math", {name: "Priority formula for Zerind"})).toHaveTextContent("f(Zerind) = g + h = 1.0 + 1.00 = 2.00");
  expect(within(firstDecision).getByRole("math", {name: "Lowest priority formula"})).toHaveTextContent("min{f(Zerind) = 2.00} = f(Zerind) = 2.00");
  expect(screen.queryByRole("region", {name: "Scrollable grounded Kirchhoff matrix"})).not.toBeInTheDocument();
});
