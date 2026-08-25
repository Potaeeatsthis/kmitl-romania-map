"use client";

import { useEffect } from "react";
import type { CSSProperties } from "react";
import { getTimelineLength } from "../../lib/traceSelectors";
import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./PlaybackControls.module.css";

const FRAME_DURATION_MS = 850;

export default function PlaybackControls({
  minimized,
  onMinimizedChange,
}: {
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
}) {
  const data = useSearchStore((state) => state.data);
  const step = useSearchStore((state) => state.step);
  const isPlaying = useSearchStore((state) => state.isPlaying);
  const speed = useSearchStore((state) => state.speed);
  const isLoading = useSearchStore((state) => state.isLoading);
  const play = useSearchStore((state) => state.play);
  const pause = useSearchStore((state) => state.pause);
  const replay = useSearchStore((state) => state.replay);
  const setStep = useSearchStore((state) => state.setStep);
  const setSpeed = useSearchStore((state) => state.setSpeed);

  const timelineLength = getTimelineLength(data);
  const lastStep = Math.max(0, timelineLength - 1);
  const animationComplete = timelineLength > 0 && step >= lastStep;
  const progress = timelineLength > 0
    ? ((Math.min(step, lastStep) + 1) / timelineLength) * 100
    : 0;

  useEffect(() => {
    if (!isPlaying || timelineLength === 0) return;

    if (animationComplete) {
      pause();
      return;
    }

    const timer = window.setTimeout(() => {
      setStep(Math.min(step + 1, lastStep));
    }, FRAME_DURATION_MS / speed);

    return () => window.clearTimeout(timer);
  }, [animationComplete, isPlaying, lastStep, pause, setStep, speed, step, timelineLength]);

  if (minimized) {
    return (
      <button
        className={styles.playbackMinimized}
        type="button"
        onClick={() => onMinimizedChange(false)}
        aria-label="Open playback controls"
        title="Open playback controls"
      >
        <span>Playback</span>
      </button>
    );
  }

  return (
    <div className={styles.animationControls}>
      <button
        className={styles.playbackMinimizeButton}
        type="button"
        onClick={() => onMinimizedChange(true)}
        aria-label="Minimize playback controls"
        title="Minimize playback controls"
      >
        <span className={styles.departureIcon} aria-hidden="true">−</span>
      </button>
      <span className={styles.playbackLabel}>Playback</span>
      <div className={styles.controls}>
        <button
          className={styles.controlButton}
          type="button"
          onClick={isPlaying ? pause : play}
          disabled={!data || isLoading}
          aria-label={isPlaying ? "Pause animation" : "Play animation"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className={styles.controlButton} type="button" onClick={replay} disabled={!data || isLoading} aria-label="Replay animation" title="Replay">
          <ReplayIcon />
        </button>
        <label className={styles.speedControl}>
          <span>Speed</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
      </div>
      <label className={styles.frameScrubber}>
        <span>Frame scroll</span>
        <output aria-live="polite">
          {timelineLength ? Math.min(step, lastStep) + 1 : 0} / {timelineLength}
        </output>
        <input
          type="range"
          min={0}
          max={lastStep}
          step={1}
          value={timelineLength ? Math.min(step, lastStep) : 0}
          disabled={!data || timelineLength <= 1 || isLoading}
          aria-label="Animation frame"
          style={{ "--frame-progress": progress + "%" } as CSSProperties}
          onChange={(event) => {
            pause();
            setStep(Number(event.target.value));
          }}
          onWheel={(event) => {
            if (!data || timelineLength <= 1) return;
            event.preventDefault();
            pause();
            const direction = event.deltaY > 0 ? 1 : -1;
            setStep(Math.min(lastStep, Math.max(0, step + direction)));
          }}
        />
      </label>
    </div>
  );
}

function PlayIcon() {
  return <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path d="M3 2h3v2h3v2h3v2h3v4h-3v2H9v2H6v2H3Z" fill="currentColor" /></svg>;
}

function PauseIcon() {
  return <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path d="M3 2h6v16H3Zm2 3v10h2V5Zm6-3h6v16h-6Zm2 3v10h2V5Z" fill="currentColor" fillRule="evenodd" /></svg>;
}

function ReplayIcon() {
  return <svg className={styles.controlIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path d="M2 3h3V1h2v2h7v2H7v2H5v2H3V7H1V3Zm12 2h2v2h2v7h-2v2h-2v2H6v-2h8v-2h2V7h-2Z" fill="currentColor" /></svg>;
}
