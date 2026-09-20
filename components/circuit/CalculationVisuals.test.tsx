// components/circuit/CalculationVisuals.test.tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CircuitSchematic } from "./CalculationVisuals";
import { CircuitMotionControl, CircuitMotionProvider } from "./CircuitMotion";
import { installMatchMedia } from "./testMatchMedia";

function renderSchematic(current: number): SVGSVGElement {
  const { container } = render(
    <CircuitSchematic
      fromLabel="Arad"
      fromVoltage={100}
      toLabel="Oradea"
      toVoltage={20}
      resistance={75}
      conductance={1 / 75}
      current={current}
    />,
  );
  return container.querySelector("svg") as SVGSVGElement;
}

describe("CircuitSchematic current flow", () => {
  it("animates forward and draws a right arrow for positive current", () => {
    const svg = renderSchematic(0.5);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(6);
    expect(svg.textContent).toContain("→ I = 0.5000 A");
    expect(svg.getAttribute("aria-label")).toContain("flowing toward Oradea");
  });

  it("animates backward and draws a left arrow for negative current", () => {
    const svg = renderSchematic(-0.5);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(6);
    expect(svg.textContent).toContain("← I = 0.5000 A");
    expect(svg.getAttribute("aria-label")).toContain("flowing away from Oradea");
  });

  it("draws no dots and no direction arrow for zero current", () => {
    const svg = renderSchematic(0);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(svg.textContent).not.toContain("→");
    expect(svg.textContent).not.toContain("←");
    // The wire, resistor, and value labels are all still there.
    expect(svg.querySelectorAll("line").length).toBeGreaterThan(0);
    expect(svg.querySelector("polyline")).not.toBeNull();
    expect(svg.textContent).toContain("Arad");
    expect(svg.textContent).toContain("Oradea");
    expect(svg.textContent).toContain("R = 75");
    expect(svg.textContent).toContain("I = 0.0000 A");
    expect(svg.getAttribute("aria-label")).toContain("no current flow");
  });

  it("treats a roundoff-level current as no flow", () => {
    const svg = renderSchematic(1e-12);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(svg.textContent).not.toContain("→");
    expect(svg.textContent).not.toContain("←");
    expect(svg.getAttribute("aria-label")).toContain("no current flow");
  });
});

function renderSchematicInMotion(current: number): SVGSVGElement {
  const { container } = render(
    <CircuitMotionProvider>
      <CircuitMotionControl />
      <CircuitSchematic
        fromLabel="Arad"
        fromVoltage={100}
        toLabel="Oradea"
        toVoltage={20}
        resistance={75}
        conductance={1 / 75}
        current={current}
      />
    </CircuitMotionProvider>,
  );
  return container.querySelector("svg") as SVGSVGElement;
}

const staticDotCount = (svg: SVGSVGElement) =>
  svg.querySelectorAll('g[class*="flowDotsStatic"] circle').length;

describe("CircuitSchematic motion control", () => {
  it("pauses the flow dots and keeps the direction arrow and values", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const svg = renderSchematicInMotion(0.5);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(6);
    expect(staticDotCount(svg)).toBe(0);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(staticDotCount(svg)).toBe(6);
    expect(svg.textContent).toContain("→ I = 0.5000 A");
    expect(svg.textContent).toContain("R = 75");
    expect(svg.textContent).toContain("Arad");
    expect(svg.textContent).toContain("Oradea");
  });

  it("resumes motion when the reader presses Resume", async () => {
    installMatchMedia(false);
    const user = userEvent.setup();
    const svg = renderSchematicInMotion(0.5);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    await user.click(screen.getByRole("button", { name: "Resume animation" }));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(6);
    expect(staticDotCount(svg)).toBe(0);
  });

  it("starts paused with static dots and a direction arrow under reduced motion", () => {
    installMatchMedia(true);
    const svg = renderSchematicInMotion(0.5);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(staticDotCount(svg)).toBe(6);
    expect(svg.textContent).toContain("→ I = 0.5000 A");
  });

  it("drops the dots when the system switches to reduced motion", () => {
    const media = installMatchMedia(false);
    const svg = renderSchematicInMotion(0.5);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(6);

    act(() => media.setReduced(true));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(staticDotCount(svg)).toBe(6);
    expect(svg.textContent).toContain("→ I = 0.5000 A");
  });

  it("keeps zero current still in both modes", async () => {
    installMatchMedia(true);
    const user = userEvent.setup();
    const svg = renderSchematicInMotion(0);
    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(staticDotCount(svg)).toBe(0);

    await user.click(screen.getByRole("button", { name: "Resume animation" }));

    expect(svg.querySelectorAll("animateMotion")).toHaveLength(0);
    expect(staticDotCount(svg)).toBe(0);
    expect(svg.textContent).toContain("I = 0.0000 A");
    expect(svg.textContent).not.toContain("→");
  });
});
