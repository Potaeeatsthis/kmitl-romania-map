// components/search/RomaniaSearch.test.tsx
import { act, render } from "@testing-library/react";
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

  // Regression: the input's onBlur used a 100ms window.setTimeout that captured
  // selectedCity at blur time. Focusing the input and then picking a city on the
  // map blurred first (capturing the old/empty selection), the map click updated
  // the store, and the pending timer then overwrote the fresh label with the stale
  // one. The fix restores the label synchronously from the current prop and drops
  // the timer entirely, so the input must still match the store after the old
  // timer's window has elapsed.
  it("keeps the map-selected city in the input after the old blur timer window", async () => {
    const user = userEvent.setup();
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
    render(<RomaniaSearch />);

    const input = screen.getByRole("combobox", { name: "STARTING POINT" });
    await user.click(input);
    await user.click(screen.getByRole("button", { name: "Choose Timisoara as starting point" }));

    expect(useSearchStore.getState().startCity).toBe(4);
    expect(input).toHaveValue("Timisoara");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(input).toHaveValue("Timisoara");
    expect(useSearchStore.getState().startCity).toBe(4);
  });

  // Regression: options used to be native <button>s, so they were Tab stops. A
  // Tab from the input landed on the first option and the blur timer then removed
  // the listbox out from under the focused element. Options now use the
  // aria-activedescendant pattern (role="option" on non-focusable elements), so
  // Tab must skip the open listbox and land on the next field.
  it("tabs past the open listbox to the next field", async () => {
    const user = userEvent.setup();
    render(<RomaniaSearch />);

    const start = screen.getByRole("combobox", { name: "STARTING POINT" });
    await user.click(start);
    await user.clear(start);
    await user.type(start, "a");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "DESTINATION" }));
    expect(start).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a pointer-chosen city after focus moves on and no late reset fires", async () => {
    const user = userEvent.setup();
    useSearchStore.setState({
      data: null,
      startCity: null,
      destinationCity: null,
      selecting: "start",
    });
    render(<RomaniaSearch />);

    const input = screen.getByRole("combobox", { name: "STARTING POINT" });
    await user.click(input);
    await user.clear(input);
    await user.type(input, "tim");
    await user.click(screen.getByRole("option", { name: "Timisoara" }));

    expect(useSearchStore.getState().startCity).toBe(4);
    expect(input).toHaveValue("Timisoara");

    await user.click(screen.getByRole("combobox", { name: "DESTINATION" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(input).toHaveValue("Timisoara");
    expect(useSearchStore.getState().startCity).toBe(4);
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

  it("renders the compact route launcher alongside the panel for the phone breakpoint", () => {
    render(<RomaniaSearch />);

    // The launcher's visibility is a CSS decision (it is hidden on desktop),
    // so both must exist on first paint for the phone layout to show the
    // compact button without a matchMedia hydration mismatch.
    expect(screen.getByRole("button", { name: "Route" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose your route" })).toBeInTheDocument();
  });

  it("keeps the map key visible without a disclosure control", () => {
    render(<RomaniaSearch />);

    const legend = screen.getByRole("complementary", { name: "Map key" });

    expect(legend).toHaveTextContent("Not discovered");
    expect(legend).toHaveTextContent("Final optimal path");
    expect(screen.queryByRole("button", { name: "Map key" })).not.toBeInTheDocument();
  });

  it("renders the homepage dark-only with no theme toggle", () => {
    render(<RomaniaSearch />);

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Replay animation" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Switch to (dark|light) mode/ }),
    ).not.toBeInTheDocument();
  });

  it("stays dark without touching the document theme when a light preference is saved", () => {
    window.localStorage.setItem("romania-search-theme", "light");

    render(<RomaniaSearch />);

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(document.documentElement.style.colorScheme).toBe("");
    expect(window.localStorage.getItem("romania-search-theme")).toBe("light");
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

    // The Default/Terrain/Satellite selector was removed -- the map renders the
    // Default appearance only, so neither the mode group nor its options exist.
    expect(screen.queryByRole("group", { name: "Map display mode" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /map display/i })).not.toBeInTheDocument();
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
