// app/theme.test.ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("dark-only theme", () => {
  it("server-renders the dark attribute and ships no theme script", () => {
    const layout = read("app/layout.tsx");

    expect(layout).toMatch(/<html[^>]*data-theme="dark"/);
    expect(layout).not.toContain("theme-boot");
    expect(layout).not.toContain("next/script");
    expect(existsSync(path.join(process.cwd(), "public/theme-boot.js"))).toBe(false);
  });

  it("defaults the global tokens and native color scheme to dark", () => {
    const css = read("app/globals.css");
    const root = css.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(root).toMatch(/color-scheme:\s*dark/);
    expect(root).toMatch(/--canvas:\s*#1b1919/);
    expect(css).not.toMatch(/color-scheme:\s*light/);
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).not.toContain(':root[data-theme="dark"]');
  });
});
