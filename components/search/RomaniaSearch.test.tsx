// components/search/RomaniaSearch.test.tsx
import { render } from "@testing-library/react";
import { fireEvent, screen, waitFor, within } from "@testing-library/dom";
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

    expect(within(listbox).getAllByRole("option").map((option: HTMLElement) => option.textContent)).toEqual([
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
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
    render(<RomaniaSearch />);

    // The search only fires once both a start and a destination are chosen -- a
    // single click never searches against a stale or default city.
    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));
    expect(mockedRunSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Choose Neamt as destination" }));

    await waitFor(() => expect(mockedRunSearch).toHaveBeenCalledWith(4, 19));
    expect(useSearchStore.getState().isPlaying).toBe(true);
  });

  it("starts with nothing selected and no reset button", () => {
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
    render(<RomaniaSearch />);

    expect(screen.queryByRole("button", { name: "Clear selection" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "STARTING POINT" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "DESTINATION" })).toHaveValue("");
  });

  it("resets to blank and snaps the map back to its default viewport", async () => {
    const user = userEvent.setup();
    mockedRunSearch.mockResolvedValue(sample);
    useSearchStore.setState({
      data: sample,
      startCity: 4,
      destinationCity: 19,
      selecting: "start",
    });
    const { container } = render(<RomaniaSearch />);
    const map = container.querySelector("svg[aria-label^=\"Animated Romania road graph\"]");

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(map).toHaveAttribute("viewBox", "210 115 720 520");

    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(useSearchStore.getState()).toMatchObject({
      startCity: null,
      destinationCity: null,
      data: null,
    });
    expect(map).toHaveAttribute("viewBox", "120 50 900 650");
    expect(screen.queryByRole("button", { name: "Clear selection" })).not.toBeInTheDocument();
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

  it("switches the map display mode from the bottom-left selector", async () => {
    const user = userEvent.setup();
    const { container } = render(<RomaniaSearch />);
    const mapPanel = container.querySelector("." + mapStyles.mapPanel);
    const displayModeControls = screen.getByRole("group", { name: "Map display mode" });
    const defaultMode = screen.getByRole("button", { name: "Use default map display" });
    const terrainMode = screen.getByRole("button", { name: "Use terrain map display" });
    const satelliteMode = screen.getByRole("button", { name: "Use satellite map display" });

    expect(displayModeControls).toHaveClass(mapStyles.displayModeControls);
    expect(mapPanel).toHaveClass(mapStyles.displayDefault);
    expect(defaultMode).toHaveAttribute("aria-pressed", "true");

    await user.click(terrainMode);
    expect(mapPanel).toHaveClass(mapStyles.displayTerrain);
    expect(terrainMode).toHaveAttribute("aria-pressed", "true");

    await user.click(satelliteMode);
    expect(mapPanel).toHaveClass(mapStyles.displaySatellite);
    expect(satelliteMode).toHaveAttribute("aria-pressed", "true");
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

  // Regression: setPointerCapture used to fire unconditionally on every pointerdown
  // once zoomed, which redirects the click that follows to the capturing element
  // instead of the city <g> under the pointer. docs/runbook.md, rootcause
  // search-map-zoom-blocks-city-clicks.
  //
  // Note: jsdom does not simulate the browser's click-redirection-on-capture
  // behavior, so this test alone would still pass against the pre-fix code (verified
  // directly: stashing the fix and re-running left this test green). It's kept as a
  // behavioral spec of the intended outcome, but the next test is the one that
  // actually catches this regression, by asserting on the underlying mechanism
  // jsdom *can* observe -- exactly when setPointerCapture is called.
  it("selects a city by clicking even after zooming in", async () => {
    const user = userEvent.setup();
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
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
    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));

    expect(useSearchStore.getState().startCity).toBe(4);
  });

  it("does not capture the pointer until the drag threshold is crossed", () => {
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
    // jsdom doesn't implement real setPointerCapture semantics; assign a spy directly
    // so the assertions below reflect this component's own calls, not a jsdom stub.
    const captureSpy = vi.fn();
    Object.assign(map!, { setPointerCapture: captureSpy });

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    fireEvent.pointerDown(map!, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 450, clientY: 325 });
    expect(captureSpy).not.toHaveBeenCalled();

    fireEvent.pointerUp(map!, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 450, clientY: 325 });
    expect(captureSpy).not.toHaveBeenCalled();

    fireEvent.pointerDown(map!, { pointerId: 2, pointerType: "mouse", button: 0, clientX: 450, clientY: 325 });
    fireEvent.pointerMove(map!, { pointerId: 2, pointerType: "mouse", buttons: 1, clientX: 550, clientY: 325 });
    expect(captureSpy).toHaveBeenCalledWith(2);
  });

  it("does not select a city when the pointer drags across the map", async () => {
    const user = userEvent.setup();
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
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
    fireEvent.pointerUp(map!, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 550, clientY: 325 });

    expect(map).toHaveAttribute("viewBox", "130 115 720 520");
    expect(useSearchStore.getState().startCity).toBeNull();
    expect(useSearchStore.getState().destinationCity).toBeNull();
  });

  it("leaves the map viewport untouched when a zoomed-in click triggers a rolling restart", async () => {
    const user = userEvent.setup();
    useSearchStore.setState({
      data: sample,
      startCity: 0,
      destinationCity: 12,
      selecting: "start",
    });
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
    expect(map).toHaveAttribute("viewBox", "210 115 720 520");

    // Route is already complete (0/12) -- this click rolling-restarts from Timisoara.
    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));

    expect(useSearchStore.getState()).toMatchObject({ startCity: 4, destinationCity: null });
    expect(map).toHaveAttribute("viewBox", "210 115 720 520");
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

  it("reveals only dark A* county dots as the expanded route advances", () => {
    const firstRouteStep = sample.astar.explored_order.indexOf(sample.astar.path[1]);
    useSearchStore.setState({ step: Math.max(0, firstRouteStep - 1) });
    const view = render(<RomaniaSearch />);

    expect(view.container.querySelector("." + mapStyles.routeDots)).toBeNull();

    useSearchStore.setState({ step: firstRouteStep });
    view.rerender(<RomaniaSearch />);
    const partialField = view.container.querySelector(
      "." + mapStyles.routeDots + "." + mapStyles.astarRouteDots,
    );

    expect(partialField).not.toBeNull();
    expect(view.container.querySelector("." + mapStyles.routeDots + "." + mapStyles.ucsPath)).toBeNull();

    useSearchStore.setState({
      step: Math.max(sample.ucs.trace.length, sample.astar.trace.length) - 1,
    });
    view.rerender(<RomaniaSearch />);
    const completeField = view.container.querySelector(
      "." + mapStyles.routeDots + "." + mapStyles.astarRouteDots,
    );

    expect(completeField!.querySelectorAll("[data-route-county]").length).toBeGreaterThan(1);
    expect(completeField!.querySelector("." + mapStyles.routeDotsNear)).not.toBeNull();
    expect(completeField!.querySelector("." + mapStyles.routeDotsMid)).not.toBeNull();
    expect(completeField!.querySelector("." + mapStyles.routeDotsFar)).not.toBeNull();
    for (const dot of completeField!.querySelectorAll("circle")) {
      expect(dot).toHaveAttribute("r", "1.8");
      expect(dot.getAttribute("style")).toContain("--route-dot-delay");
    }
  });
});
