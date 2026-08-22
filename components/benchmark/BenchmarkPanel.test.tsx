// components/benchmark/BenchmarkPanel.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { SearchResponse } from "../../lib/types";
import sampleData from "../../public/data/arad-bucharest-search.json";
import { useSearchStore } from "../../stores/useSearchStore";
import BenchmarkPanel from "./BenchmarkPanel";

const sample = sampleData as SearchResponse;

beforeEach(() => {
  useSearchStore.setState({
    data: sample,
    startCity: 0,
    destinationCity: 12,
    isLoading: false,
    error: null,
  });
});

describe("BenchmarkPanel", () => {
  it("keeps the closed drawer out of keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<BenchmarkPanel />);

    const panel = document.querySelector("aside");
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");

    await user.click(screen.getByRole("button", { name: "Open benchmark results" }));

    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Close benchmark results" })).toHaveFocus();
  });

  it("shows the all-pairs benchmark and exact selected-route details", async () => {
    const user = userEvent.setup();
    render(<BenchmarkPanel />);

    await user.click(screen.getByRole("button", { name: "Open benchmark results" }));

    expect(screen.getByText("31%")).toBeInTheDocument();
    expect(screen.getByText("31% fewer expansions")).toBeInTheDocument();
    expect(screen.getByText("UCS 13 → A* 9 expansions")).toBeInTheDocument();
    expect(screen.getByText(/All 400 pairs:/)).toHaveTextContent(
      "4,200 → 2,436 expansions (42% fewer).",
    );
    expect(screen.getByRole("heading", { name: "Arad → Bucharest" })).toBeInTheDocument();
    expect(screen.getByText("418 km")).toBeInTheDocument();
    expect(screen.getByText(/Arad → Sibiu → Rimnicu Vilcea → Pitesti → Bucharest/)).toBeInTheDocument();
  });

  it("updates the route details for the selected starting point and destination", async () => {
    const user = userEvent.setup();
    const path = [4, 5, 6, 7, 8, 10, 12, 14, 17, 18, 19];
    const selectedData: SearchResponse = {
      ucs: { ...sample.ucs, path, cost: 942, expanded: 18 },
      astar: { ...sample.astar, path, cost: 942, expanded: 11 },
    };

    useSearchStore.setState({
      data: selectedData,
      startCity: 4,
      destinationCity: 19,
    });
    render(<BenchmarkPanel />);

    await user.click(screen.getByRole("button", { name: "Open benchmark results" }));

    expect(screen.getByRole("heading", { name: "Timisoara → Neamt" })).toBeInTheDocument();
    expect(screen.getByText("942 km")).toBeInTheDocument();
    expect(screen.getByText("39%")).toBeInTheDocument();
    expect(screen.getByText("39% fewer expansions")).toBeInTheDocument();
    expect(screen.getByText(/Timisoara → Lugoj → Mehadia → Drobeta/)).toBeInTheDocument();
  });

  it("closes with Escape and returns focus to the results button", async () => {
    const user = userEvent.setup();
    render(<BenchmarkPanel />);

    await user.click(screen.getByRole("button", { name: "Open benchmark results" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open benchmark results" })).toHaveFocus();
    });
  });
});
