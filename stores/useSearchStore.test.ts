// stores/useSearchStore.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import sampleData from "../public/data/arad-bucharest-search.json";
import type { SearchResponse } from "../lib/types";
import { runSearch } from "../lib/wasm/client";
import { useSearchStore } from "./useSearchStore";

vi.mock("../lib/wasm/client", () => ({
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

describe("useSearchStore", () => {
  it("runs the selected Rust search and starts playback", async () => {
    mockedRunSearch.mockResolvedValue(sample);
    useSearchStore.setState({ startCity: 4, destinationCity: 19 });

    const pending = useSearchStore.getState().run();
    expect(useSearchStore.getState().isLoading).toBe(true);
    await pending;

    expect(mockedRunSearch).toHaveBeenCalledWith(4, 19);
    expect(useSearchStore.getState()).toMatchObject({
      data: sample,
      step: 0,
      isPlaying: true,
      isLoading: false,
      error: null,
    });
  });

  it("shows a useful error when the Wasm search fails", async () => {
    mockedRunSearch.mockRejectedValue(new Error("Wasm module unavailable"));

    await useSearchStore.getState().run();

    expect(useSearchStore.getState()).toMatchObject({
      data: null,
      isPlaying: false,
      isLoading: false,
      error: "Could not run the Rust search. Wasm module unavailable",
    });
  });

  // Regression: setCity nulls `data`, so a change that does not re-run leaves the
  // benchmark panel's expansion ring showing a dash forever. docs/runbook.md §8.
  it("runs the search only once both cities are chosen", async () => {
    mockedRunSearch.mockResolvedValue(sample);
    useSearchStore.setState({ startCity: null, destinationCity: null, selecting: "start" });

    useSearchStore.getState().setCity("start", 4);
    expect(mockedRunSearch).not.toHaveBeenCalled();
    expect(useSearchStore.getState().data).toBeNull();

    useSearchStore.getState().setCity("destination", 19);
    await vi.waitFor(() => expect(mockedRunSearch).toHaveBeenCalledWith(4, 19));
    expect(useSearchStore.getState().data).not.toBeNull();
  });

  it("toggles selecting when the same city is clicked again before a route is complete", () => {
    useSearchStore.setState({ startCity: null, destinationCity: 12, selecting: "destination" });

    useSearchStore.getState().setCity("destination", 12);

    expect(mockedRunSearch).not.toHaveBeenCalled();
    expect(useSearchStore.getState().selecting).toBe("start");
  });

  // Rolling restart: once a route is complete, the next click is not "overwrite
  // whichever field selecting points to" -- it starts a brand new route from the
  // clicked city. docs/rootcause/search-ui-third-click-no-rolling-restart.json.
  it("rolling-restarts from a third click once a route is complete", async () => {
    mockedRunSearch.mockResolvedValue(sample);
    useSearchStore.setState({
      startCity: 0,
      destinationCity: 12,
      data: sample,
      selecting: "start",
    });

    useSearchStore.getState().setCity("start", 7);

    expect(useSearchStore.getState()).toMatchObject({
      startCity: 7,
      destinationCity: null,
      selecting: "destination",
      data: null,
      step: 0,
      isPlaying: false,
      error: null,
    });
    expect(mockedRunSearch).not.toHaveBeenCalled();

    useSearchStore.getState().setCity("destination", 15);
    await vi.waitFor(() => expect(mockedRunSearch).toHaveBeenCalledWith(7, 15));
    expect(useSearchStore.getState().data).not.toBeNull();
  });

  it("rolling-restarts even when the clicked city is already a current endpoint", () => {
    useSearchStore.setState({
      startCity: 0,
      destinationCity: 12,
      data: sample,
      selecting: "start",
    });

    useSearchStore.getState().setCity("destination", 12);

    expect(useSearchStore.getState()).toMatchObject({
      startCity: 12,
      destinationCity: null,
      selecting: "destination",
      data: null,
    });
    expect(mockedRunSearch).not.toHaveBeenCalled();
  });

  it("clamps frames and toggles playback safely", () => {
    const lastStep = Math.max(sample.ucs.trace.length, sample.astar.trace.length) - 1;

    useSearchStore.getState().setStep(999);
    expect(useSearchStore.getState().step).toBe(lastStep);

    useSearchStore.getState().play();
    expect(useSearchStore.getState()).toMatchObject({ step: 0, isPlaying: true });

    useSearchStore.getState().pause();
    expect(useSearchStore.getState().isPlaying).toBe(false);
  });
});
