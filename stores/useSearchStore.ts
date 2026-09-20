// stores/useSearchStore.ts
"use client";

import { create } from "zustand";

import type { SearchResponse } from "../lib/types";
import { runSearch as runWasmSearch } from "../lib/wasm/client";

type RouteField = "start" | "destination";

type SearchState = {
  data: SearchResponse | null;
  startCity: number | null;
  destinationCity: number | null;
  selecting: RouteField;
  step: number;
  isPlaying: boolean;
  speed: number;
  isLoading: boolean;
  error: string | null;
  setCity: (field: RouteField, city: number) => void;
  setSelecting: (field: RouteField) => void;
  run: () => Promise<void>;
  play: () => void;
  pause: () => void;
  replay: () => void;
  setStep: (step: number) => void;
  setSpeed: (speed: number) => void;
  reset: () => void;
};

let requestGeneration = 0;

export const useSearchStore = create<SearchState>((set, get) => ({
  data: null,
  startCity: null,
  destinationCity: null,
  selecting: "start",
  step: 0,
  isPlaying: false,
  speed: 1,
  isLoading: false,
  error: null,

  // Sets the clicked city and toggles `selecting` -- it does NOT run the search
  // itself. The search only fires once both startCity and destinationCity are
  // non-null (checked here, and guarded again inside run() as a safety net), so a
  // single click never searches against a stale or default city. See
  // docs/rootcause/search-ui-no-clean-slate-reset.json.
  //
  // Rolling restart: if a route is already complete (both cities set) when a click
  // arrives, that click is not "the next field to overwrite" -- it starts a brand
  // new route from scratch, regardless of which field was clicked or which field
  // `selecting` currently points to. The map's pan/zoom is deliberately untouched
  // here; only the dedicated Reset button resets that. See
  // docs/rootcause/search-ui-third-click-no-rolling-restart.json.
  setCity: (field, city) => {
    const { startCity, destinationCity } = get();
    const routeComplete = startCity !== null && destinationCity !== null;

    if (routeComplete) {
      requestGeneration += 1;
      set({
        startCity: city,
        destinationCity: null,
        selecting: "destination",
        data: null,
        step: 0,
        isPlaying: false,
        isLoading: false,
        error: null,
      });
      return;
    }

    const current = field === "start" ? startCity : destinationCity;
    const nextSelecting = field === "start" ? "destination" : "start";
    const nextStartCity = field === "start" ? city : startCity;
    const nextDestinationCity = field === "destination" ? city : destinationCity;
    const bothSelected = nextStartCity !== null && nextDestinationCity !== null;

    if (current === city) {
      set({ selecting: nextSelecting });
      if (bothSelected) void get().run();
      return;
    }

    requestGeneration += 1;
    set({
      [field === "start" ? "startCity" : "destinationCity"]: city,
      selecting: nextSelecting,
      data: null,
      step: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
    } as Partial<SearchState>);

    if (bothSelected) void get().run();
  },

  setSelecting: (selecting) => set({ selecting }),

  run: async () => {
    const { startCity, destinationCity } = get();
    if (startCity === null || destinationCity === null) return;

    const generation = ++requestGeneration;
    set({ data: null, step: 0, isPlaying: false, isLoading: true, error: null });

    try {
      const data = await runWasmSearch(startCity, destinationCity);
      if (generation !== requestGeneration) return;
      set({ data, step: 0, isPlaying: true, isLoading: false });
    } catch (error: unknown) {
      if (generation !== requestGeneration) return;
      const detail = error instanceof Error ? error.message : "Unknown browser error";
      set({
        isLoading: false,
        error: `Could not run the Rust search. ${detail}`,
      });
    }
  },

  play: () => {
    const data = get().data;
    if (!data) return;
    const lastStep = Math.max(data.ucs.trace.length, data.astar.trace.length) - 1;
    set((state) => ({
      step: state.step >= lastStep ? 0 : state.step,
      isPlaying: true,
    }));
  },

  pause: () => set({ isPlaying: false }),
  replay: () => set({ step: 0, isPlaying: true }),
  setStep: (step) => {
    const data = get().data;
    const lastStep = data
      ? Math.max(data.ucs.trace.length, data.astar.trace.length) - 1
      : 0;
    set({ step: Math.min(lastStep, Math.max(0, Math.trunc(step))) });
  },
  setSpeed: (speed) => set({ speed }),

  reset: () => {
    requestGeneration += 1;
    set({
      startCity: null,
      destinationCity: null,
      selecting: "start",
      data: null,
      step: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
    });
  },
}));
