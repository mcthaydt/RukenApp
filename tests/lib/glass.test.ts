import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, lookCss, token } from "../support/look-tokens.ts";

// Frosted glass wherever something is see-through (the owner, 2026-11-22: "whenever we use transparency, let's go
// with an Apple-like Frosted Glass"). The values live once, as tokens in src/lib/look.css; every see-through surface
// reads them, and none mixes its own see-through colour. Read as text; nothing here draws.

const ROOT = join(import.meta.dirname, "../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** Every style sheet and component, as [path from the repo root, text with comments dropped]. */
const sources: [string, string][] = files(join(ROOT, "src"))
  .filter((path) => /\.(css|svelte)$/.test(path))
  .map((path) => [
    relative(ROOT, path),
    readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, ""),
  ]);

/** Every CSS rule in every source, as [path, selector, body]. Nested at-rules give their innermost rules. */
const rules: [string, string, string][] = sources.flatMap(([path, text]) =>
  [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
    (match) => [path, (match[1] ?? "").trim(), match[2] ?? ""] as [string, string, string],
  ),
);

// Not surfaces: Live's backdrop is the game's own video, already blurred by its own filter, under a dark layer; the
// drifting circles are shapes drawn on it.
const NOT_SURFACES = new Set([".backdrop::after", ".drift"]);

const isTokenBlock = (path: string, selector: string) =>
  path.endsWith("look.css") && /(^|\s):root$/.test(selector);

describe("frosted glass", () => {
  it("blurs behind a surface only with the glass or dim tokens, for every browser", () => {
    const found: string[] = [];
    for (const [path, selector, body] of rules) {
      for (const match of body.matchAll(/(?:^|[;\s])((?:-webkit-)?backdrop-filter)\s*:\s*([^;]+)/g)) {
        const value = (match[2] ?? "").trim();
        if (value !== "var(--glass-filter)" && value !== "var(--dim-filter)")
          found.push(`${path} ${selector}: ${value}`);
      }
      const plain = /(?:^|[;\s])backdrop-filter\s*:/.test(body);
      const webkit = /-webkit-backdrop-filter\s*:/.test(body);
      if (plain !== webkit)
        found.push(`${path} ${selector}: needs both backdrop-filter and -webkit-backdrop-filter`);
    }
    expect(found).toEqual([]);
  });

  it("gives no surface a see-through colour of its own", () => {
    const found: string[] = [];
    for (const [path, selector, body] of rules) {
      if (isTokenBlock(path, selector)) continue;
      const background = /(?:^|[;\s])background(?:-color)?\s*:\s*([^;]+)/.exec(body)?.[1] ?? "";
      const seeThroughColour =
        /color-mix\([^;]*transparent/.test(background) ||
        /(?:rgba|hsla)\(|(?:rgb|hsl)\([^)]*\//.test(background);
      const faded = /(?:^|[;\s])opacity\s*:\s*0?\.\d/.test(body);
      if (seeThroughColour || (background !== "" && faded && !NOT_SURFACES.has(selector)))
        found.push(`${path} ${selector}: ${background.trim()}`);
    }
    expect(found).toEqual([]);
  });

  it("is frosted: blurred, darkened, with more colour, under a thin tint of the darkest felt", () => {
    expect(token("--glass-filter")).toMatch(/blur\(\d+px\)/);
    expect(token("--glass-filter")).toMatch(/brightness\(0?\.\d+\)/);
    expect(token("--glass-filter")).toMatch(/saturate\(1\.\d+\)/);
    expect(token("--glass-bg")).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0?\.\d+\)$/);
    expect(token("--dim-bg")).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0?\.\d+\)$/);
    expect(token("--dim-filter")).toMatch(/blur\(\d+px\)/);
  });

  // The worst case is a white clip behind: darkened by the filter, then under the tint. Chalk must still read.
  it("tints with the darkest felt", () => {
    const feltDeep = token("--felt-deep");
    const channels = [1, 3, 5].map((start) => parseInt(feltDeep.slice(start, start + 2), 16)).join(" ");
    expect(token("--glass-bg").startsWith(`rgb(${channels} /`)).toBe(true);
    expect(token("--dim-bg").startsWith(`rgb(${channels} /`)).toBe(true);
  });

  // The worst case is a white clip behind: darkened by the filter, then under the tint. Chalk must still read.
  it("keeps chalk at 4.5 to 1 or more over a white clip", () => {
    const brightness = Number(/brightness\(([\d.]+)\)/.exec(token("--glass-filter"))?.[1]);
    const [red = 0, green = 0, blue = 0, alpha = 1] = (token("--glass-bg").match(/[\d.]+/g) ?? []).map(
      Number,
    );
    const behind = 255 * brightness;
    const mixed = [red, green, blue].map((channel) => Math.round(alpha * channel + (1 - alpha) * behind));
    const hex = `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    expect(contrast(token("--chalk"), hex)).toBeGreaterThanOrEqual(4.5);
  });

  it("falls back to the solid darkest felt where there is no blur, less see-through or more contrast", () => {
    const css = lookCss();
    for (const condition of [
      "@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))",
      "@media (prefers-reduced-transparency: reduce), (prefers-contrast: more)",
    ]) {
      const at = css.indexOf(condition);
      expect(at, condition).toBeGreaterThanOrEqual(0);
      const block = css.slice(at, css.indexOf("}\n}", at));
      expect(block).toContain("--glass-bg: var(--felt-deep);");
      expect(block).toContain("--glass-filter: none;");
      expect(block).toContain("--dim-filter: none;");
    }
  });
});
