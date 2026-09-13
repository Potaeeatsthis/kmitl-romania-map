import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("explains the selected city's roads and removes the grounded row", async () => {
    const user = userEvent.setup();
    render(<KirchhoffMatrixPage />);
    const select = await screen.findByRole("combobox", { name: "Explore a city" });
    await user.selectOptions(select, "2");
    expect(screen.getByRole("table", { name: "Roads connected to Oradea" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Grounded Lg/ }));
    expect(screen.getByRole("status")).toHaveTextContent("its row and column have been removed");
    expect(screen.getByRole("link", { name: "Next: matrix elimination →" })).toHaveAttribute("href", "/heuristic-steps?start=0&goal=2");
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
