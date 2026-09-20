// components/circuit/CircuitMotion.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import styles from "./CircuitMotion.module.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * The OS "reduce motion" preference, kept live.
 *
 * `useSyncExternalStore` is the native React 18+ way to read it: the first
 * client render already sees the real value. These circuit SVGs are only ever
 * mounted client-side (the explanation is fetched in an effect), so a
 * reduced-motion visitor never gets a frame of motion before the preference
 * takes effect.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false);
}

export type CircuitMotion = {
  /** True when current dots should travel; false holds them still. */
  playing: boolean;
  /** The live OS preference, so the control can explain a paused default. */
  reducedMotion: boolean;
  toggle: () => void;
};

const CircuitMotionContext = createContext<CircuitMotion | null>(null);

/**
 * One motion switch shared by every circuit map and schematic on the page.
 * The OS preference is the default; once the reader presses the control, their
 * choice wins. Without a provider a visual still honours reduced motion -- it
 * just has no shared control.
 */
export function CircuitMotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  // null = no explicit choice yet, so the OS preference decides.
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const playing = !(userPaused ?? reducedMotion);

  const toggle = useCallback(() => {
    setUserPaused((previous) => !(previous ?? reducedMotion));
  }, [reducedMotion]);

  const value = useMemo(
    () => ({ playing, reducedMotion, toggle }),
    [playing, reducedMotion, toggle],
  );

  return <CircuitMotionContext.Provider value={value}>{children}</CircuitMotionContext.Provider>;
}

/** Falls back to the OS preference when no provider is mounted. */
export function useCircuitMotion(): CircuitMotion {
  const context = useContext(CircuitMotionContext);
  const reducedMotion = useReducedMotion();
  return context ?? { playing: !reducedMotion, reducedMotion, toggle: () => {} };
}

/** The single page-level Pause / Resume control. */
export function CircuitMotionControl() {
  const { playing, reducedMotion, toggle } = useCircuitMotion();
  return (
    <div className={styles.control} role="group" aria-label="Circuit animation">
      <button type="button" className={styles.button} onClick={toggle}>
        {playing ? "Pause animation" : "Resume animation"}
      </button>
      <p className={styles.status} role="status">
        {playing
          ? "Current dots are moving on every circuit below."
          : reducedMotion
            ? "Current dots are held still (reduced motion). Arrows and values show direction."
            : "Current dots are held still. Arrows and values show direction."}
      </p>
    </div>
  );
}
