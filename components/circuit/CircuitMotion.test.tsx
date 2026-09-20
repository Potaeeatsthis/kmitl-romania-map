// components/circuit/CircuitMotion.test.tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CircuitMotionControl, CircuitMotionProvider, useCircuitMotion } from "./CircuitMotion";
import { installMatchMedia } from "./testMatchMedia";

function PlayingProbe() {
  const { playing } = useCircuitMotion();
  return <output data-testid="playing">{String(playing)}</output>;
}

function renderControl() {
  return render(
    <CircuitMotionProvider>
      <CircuitMotionControl />
      <PlayingProbe />
    </CircuitMotionProvider>,
  );
}

describe("CircuitMotionControl", () => {
  it("starts paused when the system prefers reduced motion", () => {
    installMatchMedia(true);
    renderControl();
    expect(screen.getByTestId("playing")).toHaveTextContent("false");
    expect(screen.getByRole("button", { name: "Resume animation" })).toBeInTheDocument();
  });

  it("starts playing when motion is allowed", () => {
    installMatchMedia(false);
    renderControl();
    expect(screen.getByTestId("playing")).toHaveTextContent("true");
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeInTheDocument();
  });

  it("follows a live change in the system preference", () => {
    const media = installMatchMedia(false);
    renderControl();
    expect(screen.getByTestId("playing")).toHaveTextContent("true");

    act(() => media.setReduced(true));
    expect(screen.getByTestId("playing")).toHaveTextContent("false");
    expect(screen.getByRole("button", { name: "Resume animation" })).toBeInTheDocument();

    act(() => media.setReduced(false));
    expect(screen.getByTestId("playing")).toHaveTextContent("true");
  });

  it("lets the reader resume from the reduced-motion default by keyboard", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    renderControl();

    await user.tab();
    const button = screen.getByRole("button", { name: "Resume animation" });
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByTestId("playing")).toHaveTextContent("true");
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeInTheDocument();
  });
});
