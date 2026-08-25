// components/search/RomaniaSearch.test.tsx
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import sampleData from "../../public/data/arad-bucharest-search.json";
import { romaniaGraph } from "../../lib/romaniaGraph";
import type { SearchResponse } from "../../lib/types";
import { runSearch } from "../../lib/wasm/client";
import { useSearchStore } from "../../stores/useSearchStore";
import RomaniaSearch from "./RomaniaSearch";
import mapStyles from "./SearchMap.module.css";

vi.mock("../../lib/wasm/client", () => ({
  runSearch: vi.fn(),
}));

const sample = sampleData as SearchResponse;
const mockedRunSearch = vi.mocked(runSearch);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";

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

describe("RomaniaSearch", () => {
  it("filters city options by the beginning of the name", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

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
    render(<RomaniaSearch />);

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
    render(<RomaniaSearch />);

    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));
    expect(mockedRunSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Choose Neamt as destination" }));

    await waitFor(() => expect(mockedRunSearch).toHaveBeenCalledWith(4, 19));
    expect(useSearchStore.getState().isPlaying).toBe(true);
  });

  it("collapses the route planner into a compact map button", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

    await user.click(screen.getByRole("button", { name: "Hide route planner" }));
    expect(screen.queryByRole("heading", { name: "Choose your route" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Route" }));
    expect(screen.getByRole("heading", { name: "Choose your route" })).toBeInTheDocument();
  });

  it("uses a Departure Mono black star to enable and save dark mode", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(toggle).toHaveTextContent("★");
    expect(screen.queryByText(/^Frame \d+ \/ \d+$/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay animation" })).toBeInTheDocument();

    await user.click(toggle);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem("romania-search-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("minimizes playback and reopens it without an extra icon", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

    const minimize = screen.getByRole("button", { name: "Minimize playback controls" });
    expect(minimize).toHaveTextContent("−");
    await user.click(minimize);

    const open = screen.getByRole("button", { name: "Open playback controls" });
    expect(open).toHaveTextContent(/^Playback$/);
    await user.click(open);

    expect(screen.getByRole("button", { name: "Minimize playback controls" })).toBeInTheDocument();
  });

  it("zooms the map in and out with bounded controls", async () => {
    const user = userEvent.setup();
    const { container } = render(<RomaniaSearch />);
    const map = container.querySelector("svg[aria-label^=\"Animated Romania road graph\"]");
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });

    expect(map).toHaveAttribute("viewBox", "120 50 900 650");
    expect(zoomOut).toBeDisabled();

    await user.click(zoomIn);
    expect(map).toHaveAttribute("viewBox", "210 115 720 520");
    expect(zoomOut).toBeEnabled();

    await user.click(zoomOut);
    expect(map).toHaveAttribute("viewBox", "120 50 900 650");
    expect(zoomOut).toBeDisabled();
  });

  it("pans the map by dragging after zooming in", async () => {
    const user = userEvent.setup();
    const { container } = render(<RomaniaSearch />);
    const map = container.querySelector("svg[aria-label^=\"Animated Romania road graph\"]");

    expect(map).not.toBeNull();
    vi.spyOn(map!, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      right: 900,
      bottom: 650,
      left: 0,
      width: 900,
      height: 650,
      toJSON: () => ({}),
    });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.pointerDown(map!, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 450, clientY: 325 });
    fireEvent.pointerMove(map!, { pointerId: 1, pointerType: "mouse", buttons: 1, clientX: 550, clientY: 325 });

    expect(map).toHaveAttribute("viewBox", "130 115 720 520");

    fireEvent.pointerUp(map!, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 550, clientY: 325 });
  });

  it("zooms continuously with a two-finger pinch gesture", () => {
    const { container } = render(<RomaniaSearch />);
    const map = container.querySelector("svg[aria-label^=\"Animated Romania road graph\"]");

    expect(map).not.toBeNull();
    fireEvent.pointerDown(map!, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerDown(map!, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 100 });
    fireEvent.pointerMove(map!, { pointerId: 2, pointerType: "touch", clientX: 250, clientY: 100 });

    expect(map).toHaveAttribute("viewBox", "270 158.33 600 433.33");
    expect(screen.getByRole("group", { name: "Map zoom controls, 150%" })).toBeInTheDocument();

    fireEvent.pointerUp(map!, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 100 });
    fireEvent.pointerUp(map!, { pointerId: 2, pointerType: "touch", clientX: 250, clientY: 100 });
  });

  it("zooms with a two-finger touchpad gesture without scrolling the page", () => {
    const { container } = render(<RomaniaSearch />);
    const map = container.querySelector("svg[aria-label^=\"Animated Romania road graph\"]");
    const wheel = new WheelEvent("wheel", {
      deltaY: -Math.log(1.25) / 0.0025,
      bubbles: true,
      cancelable: true,
    });

    expect(map).not.toBeNull();
    fireEvent(map!, wheel);

    expect(wheel.defaultPrevented).toBe(true);
    expect(map).toHaveAttribute("viewBox", "210 115 720 520");
    expect(screen.getByRole("group", { name: "Map zoom controls, 125%" })).toBeInTheDocument();
  });

  it("uses one button that switches between play and pause", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

    await user.click(screen.getByRole("button", { name: "Play animation" }));
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(screen.getByRole("button", { name: "Play animation" })).toBeInTheDocument();
  });

  it("uses borderless black text for highlighted route-city labels", () => {
    const view = render(<RomaniaSearch />);
    const arad = screen.getByRole("button", { name: "Choose Arad as starting point" });

    expect(arad.querySelector("text")).toHaveClass(mapStyles.highlightedCityLabel);

    view.unmount();
    useSearchStore.setState({ step: sample.ucs.trace.length - 1 });
    render(<RomaniaSearch />);

    for (const cityId of sample.ucs.path) {
      const cityName = romaniaGraph.cities[cityId].name;
      const city = screen.getByRole("button", { name: `Choose ${cityName} as starting point` });
      expect(city.querySelector("text")).toHaveClass(mapStyles.highlightedCityLabel);
    }
  });
});
