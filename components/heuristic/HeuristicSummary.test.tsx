import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import HeuristicSummaryPage from "../../app/heuristic-summary/page";
import { explainCurrentFlow, runSearch } from "../../lib/wasm/client";

const navigation = vi.hoisted(() => ({ query: "start=0&goal=2" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("../../lib/wasm/client", () => ({ explainCurrentFlow: vi.fn(), runSearch: vi.fn() }));

beforeEach(() => {
  navigation.query = "start=0&goal=2";
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
  // The h link reads as a labelled value, not a bare number.
  expect(within(queue).getByRole("link", {name: "Show how h(Zerind → Oradea) = 1.00 is calculated"})).toHaveAttribute("href", "/kirchhoff-matrix?start=1&goal=2&routeStart=0&decision=0");
  expect(within(queue).getByRole("link", {name: "Show how h(Zerind → Oradea) = 1.00 is calculated"})).toHaveTextContent("h(Zerind → Oradea) = 1.00");
  const firstDecision = screen.getByRole("math", {name: "Priority formula for Zerind"}).closest("article")!;
  expect(within(firstDecision).getByRole("math", {name: "Priority formula for Zerind"})).toHaveTextContent("f(Zerind) = g + h = 1.0 + 1.00 = 2.00");
  expect(within(firstDecision).getByRole("math", {name: "Lowest priority formula"})).toHaveTextContent("min{f(Zerind) = 2.00} = f(Zerind) = 2.00");
  expect(screen.queryByRole("region", {name: "Scrollable grounded Kirchhoff matrix"})).not.toBeInTheDocument();
});

it("labels the default selection with the route start", async () => {
  render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Arad → Oradea)");
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2");
});

it("keeps the selected city in the stepper while searching the original route", async () => {
  navigation.query = "start=0&goal=2&explained=1&decision=0";
  render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Zerind → Oradea)");
  // The stepper explains Zerind, but the A* walkthrough below is still the
  // original Arad -> Oradea route.
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=1&goal=2&routeStart=0&decision=0");
  expect(screen.getByRole("link", {name: "Kirchhoff matrix"})).toHaveAttribute("href", "/kirchhoff-matrix?start=1&goal=2&routeStart=0&decision=0");
  expect(vi.mocked(runSearch)).toHaveBeenCalledWith(0, 2);
});

it("falls back to the route start for an invalid explained city", async () => {
  navigation.query = "start=0&goal=2&explained=99";
  render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Arad → Oradea)");
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2");
});

it("ignores a selected city when the decision is missing", async () => {
  // A selection without its decision is incomplete: the stepper would forward
  // routeStart with no decision and the calculation pages would drop the
  // overall route context. Fall back to the route-start default instead.
  navigation.query = "start=0&goal=2&explained=3";
  render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Arad → Oradea)");
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2");
});

it("ignores a selected city when the decision is malformed", async () => {
  navigation.query = "start=0&goal=2&explained=3&decision=abc";
  render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Arad → Oradea)");
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2");
});

it("treats an explained city that repeats the route start as the default selection", async () => {
  navigation.query = "start=0&goal=2&explained=1&decision=0";
  const { rerender } = render(<HeuristicSummaryPage />);
  await screen.findByRole("table", {name: "A star queue after expanding Arad"});
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=1&goal=2&routeStart=0&decision=0");
  // With the route now starting at Zerind, explained=1 repeats the route start,
  // so it is the default selection. Only a link that omits selection context is
  // guaranteed to reset it; a manually changed route is not inferred.
  navigation.query = "start=1&goal=2&explained=1&decision=0";
  rerender(<HeuristicSummaryPage />);
  expect(screen.getByText("Selected calculation:").closest("p")).toHaveTextContent("Selected calculation: h(Zerind → Oradea)");
  expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=1&goal=2");
});
