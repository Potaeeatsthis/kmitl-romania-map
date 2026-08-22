// components/sample/SampleGraphDemo.test.tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sampleData from "../../public/data/arad-bucharest-search.json";
import type { SearchResponse } from "../../lib/types";
import { runSearch } from "../../lib/wasm/client";
import { useSearchStore } from "../../stores/useSearchStore";
import SampleGraphDemo from "./SampleGraphDemo";

vi.mock("../../lib/wasm/client", () => ({
  runSearch: vi.fn(),
}));

const sample = sampleData as SearchResponse;
const mockedRunSearch = vi.mocked(runSearch);

beforeEach(() => {
  useSearchStore.setState({
    data: sample,
    startCity: 0,
    destinationCity: 12,
    selecting: "start",
    step: 0,
    isPlaying: false,
    speed: 1,
    isLoading: false,
    error: null,
  });
});

describe("SampleGraphDemo", () => {
  it("filters city options by the beginning of the name", async () => {
    const user = userEvent.setup();
    render(<SampleGraphDemo />);

    const input = screen.getByRole("combobox", { name: "STARTING POINT" });
    await user.clear(input);
    await user.type(input, "a");

    const listbox = screen.getByRole("listbox");

    expect(within(listbox).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Arad",
    ]);
  });

  it("announces an empty search outside the listbox", async () => {
    const user = userEvent.setup();
    render(<SampleGraphDemo />);

    const input = screen.getByRole("combobox", { name: "STARTING POINT" });
    await user.clear(input);
    await user.type(input, "xyz");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    const emptyStatus = screen.getByText("No city starts with “xyz”.");

    expect(emptyStatus).toHaveAttribute("role", "status");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("runs automatically after two cities are chosen on the map", async () => {
    const user = userEvent.setup();
    mockedRunSearch.mockResolvedValue(sample);
    render(<SampleGraphDemo />);

    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));
    expect(mockedRunSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Choose Neamt as destination" }));

    await waitFor(() => expect(mockedRunSearch).toHaveBeenCalledWith(4, 19));
    expect(useSearchStore.getState().isPlaying).toBe(true);
  });

  it("uses one button that switches between play and pause", async () => {
    const user = userEvent.setup();
    render(<SampleGraphDemo />);

    await user.click(screen.getByRole("button", { name: "Play animation" }));
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(screen.getByRole("button", { name: "Play animation" })).toBeInTheDocument();
  });
});
