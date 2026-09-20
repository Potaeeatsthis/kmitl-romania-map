// components/circuit/testMatchMedia.ts
import { vi } from "vitest";

/**
 * jsdom does not implement matchMedia, so reduced-motion tests install this
 * controllable stub. `vitest.config.mts` sets `unstubGlobals`, so the stub is
 * removed after every test and non-motion tests see no matchMedia at all.
 */
export function installMatchMedia(initialReduced: boolean) {
  const listeners = new Set<() => void>();
  let reduced = initialReduced;

  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reduced : false,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => false,
  }));

  return {
    setReduced(next: boolean) {
      reduced = next;
      listeners.forEach((listener) => listener());
    },
  };
}
