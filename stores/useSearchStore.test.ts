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
