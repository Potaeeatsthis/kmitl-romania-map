// stores/useSearchStore.ts
"use client";

import { create } from "zustand";

import sampleData from "../public/data/arad-bucharest-search.json";
import type { SearchResponse } from "../lib/types";
import { runSearch as runWasmSearch } from "../lib/wasm/client";

type RouteField = "start" | "destination";

type SearchState = {
  data: SearchResponse | null;
  startCity: number;
  destinationCity: number;
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
};

let requestGeneration = 0;

export const useSearchStore = create<SearchState>((set, get) => ({
  data: sampleData as SearchResponse,
  startCity: 0,
  destinationCity: 12,
  selecting: "start",
  step: 0,
  isPlaying: false,
  speed: 1,
  isLoading: false,
  error: null,

  setCity: (field, city) => {
    const current = field === "start" ? get().startCity : get().destinationCity;
    if (current === city) {
      set({ selecting: field === "start" ? "destination" : "start" });
      return;
    }

    requestGeneration += 1;
    set({
      [field === "start" ? "startCity" : "destinationCity"]: city,
      selecting: field === "start" ? "destination" : "start",
      data: null,
      step: 0,
      isPlaying: false,
      isLoading: false,
      error: null,
    } as Partial<SearchState>);
  },

  setSelecting: (selecting) => set({ selecting }),

  run: async () => {
    const generation = ++requestGeneration;
    const { startCity, destinationCity } = get();
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
}));
