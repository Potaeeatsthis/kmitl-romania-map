import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CircuitFlowPage from "../../app/circuit-flow/page";
import KirchhoffMatrixPage from "../../app/kirchhoff-matrix/page";
import HeuristicStepsPage from "../../app/heuristic-steps/page";
import { explainCurrentFlow } from "../../lib/wasm/client";
import type { HeuristicExplanation } from "../../lib/types";

const navigation = vi.hoisted(() => ({ query: "start=0&goal=2" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query) }));
vi.mock("../../lib/wasm/client", () => ({ explainCurrentFlow: vi.fn() }));

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

beforeEach(() => {
  navigation.query = "start=0&goal=2";
  vi.mocked(explainCurrentFlow).mockReset().mockResolvedValue(circuit);
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
    expect(screen.getByRole("math", { name: "Kirchhoff matrix formulas" })).toHaveTextContent("Lii = Σj cij");
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
    expect(screen.getByRole("link", {name: "Back to this A* decision"})).toHaveAttribute("href", "/heuristic-summary?start=1&goal=2#decision-3");
    const active = screen.getByRole("link", {name: "Kirchhoff matrix"});
    expect(active).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("href", "/circuit-flow?start=0&goal=2&routeStart=1&decision=3");
    expect(explainCurrentFlow).toHaveBeenCalledWith(0, 2);
  });

  it("shows a safe zero-current circuit for the destination itself", async () => {
    navigation.query = "start=2&goal=2";
    vi.mocked(explainCurrentFlow).mockResolvedValue({ ...circuit, start: 2, effective_resistance: 0, steps: [] });
    render(<CircuitFlowPage />);
    expect(await screen.findByText(/No current is injected/)).toBeInTheDocument();
    expect(screen.getByRole("math", { name: "Road cost, conductance, and current formulas" })).toHaveTextContent("= 1 ÷ R = 1 ÷ 1 = 1.000000");
    expect(screen.getByRole("link", {name: "Circuit view"})).toHaveAttribute("aria-current", "page");
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
  });
});
