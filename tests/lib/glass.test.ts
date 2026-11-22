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

/** A colour that lets what is behind show through: an alpha in any notation, or a mix with anything see-through. */
const SEE_THROUGH_COLOUR =
  /(?:rgba|hsla)\(|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\([^)]*\/|#(?:[0-9a-f]{4}|[0-9a-f]{8})\b|color-mix\([^;]*\btransparent\b/i;

/** A share between 0 and 1 (not 0, which hides, and not 1, which is solid), written as a number or a percentage. */
const isPartial = (value: string): boolean => {
  const share = value.trim().endsWith("%") ? Number.parseFloat(value) / 100 : Number.parseFloat(value);
  return share > 0 && share < 1;
};

/** Why a rule is a see-through surface of its own making, or null when it is not one. */
function seeThrough(selector: string, body: string): string | null {
  const backgrounds = [...body.matchAll(/(?:^|[;\s])background(?:-color|-image)?\s*:\s*([^;]+)/g)].map(
    (match) => (match[1] ?? "").trim(),
  );
  const colour = backgrounds.find((value) => SEE_THROUGH_COLOUR.test(value));
  if (colour !== undefined) return colour;
  if (backgrounds.length === 0 || NOT_SURFACES.has(selector)) return null;
  const opacity = /(?:^|[;\s])opacity\s*:\s*([^;]+)/.exec(body)?.[1];
  if (opacity !== undefined && isPartial(opacity)) return `opacity: ${opacity.trim()}`;
  const filter = /(?:^|[;\s])filter\s*:\s*([^;]+)/.exec(body)?.[1] ?? "";
  const filterOpacity = /opacity\(([^)]+)\)/.exec(filter)?.[1];
  if (filterOpacity !== undefined && isPartial(filterOpacity)) return `filter: ${filter.trim()}`;
  return null;
}

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
      const reason = seeThrough(selector, body);
      if (reason !== null) found.push(`${path} ${selector}: ${reason}`);
    }
    expect(found).toEqual([]);
  });

  // The guard itself: every way of writing see-through it should catch, and what it should leave alone.
  it.each([
    ["background: #00000080;"],
    ["background-color: #0008;"],
    ["background: rgba(0, 0, 0, 0.5);"],
    ["background: rgb(0 0 0 / 50%);"],
    ["background: hsl(0 0% 0% / .5);"],
    ["background: color-mix(in srgb, var(--ink) 50%, transparent);"],
    ["background: color-mix(in srgb, var(--ink) 50%, #0000);"],
    ["background: var(--felt-deep); opacity: 0.8;"],
    ["background: var(--felt-deep); opacity: .8;"],
    ["background: var(--felt-deep); opacity: 80%;"],
    ["background: var(--felt-deep); filter: opacity(0.6);"],
    ["background: var(--felt-deep); filter: blur(2px) opacity(60%);"],
    ["color: red; background: var(--felt-deep); background-color: rgb(0 0 0 / 0.4);"],
    ["background: oklch(0 0 0 / 0.5);"],
    ["background: lab(0 0 0 / 50%);"],
    ["background: hwb(0 0% 100% / 0.5);"],
    ["background: color(srgb 0 0 0 / 0.5);"],
    ["background-image: linear-gradient(rgb(0 0 0 / 0.5), rgb(0 0 0 / 0.5));"],
  ])("catches %s", (body) => {
    expect(seeThrough(".m", body)).not.toBeNull();
  });

  it.each([
    ["background: var(--felt-deep);"],
    ["background: transparent;"],
    ["background: none;"],
    ["background: #111314;"],
    ["background: #fff;"],
    ["background: var(--glass-bg);"],
    ["background: var(--felt-deep); opacity: 1;"],
    ["background: var(--felt-deep); opacity: 100%;"],
    ["opacity: 0.5;"],
    ["background: var(--felt-deep); opacity: 0;"],
  ])("leaves alone %s", (body) => {
    expect(seeThrough(".m", body)).toBeNull();
  });

  it("is frosted: blurred, darkened, with more colour, under a thin tint of the darkest felt", () => {
    expect(token("--glass-filter")).toMatch(/blur\(\d+px\)/);
    expect(token("--glass-filter")).toMatch(/brightness\(0?\.\d+\)/);
    expect(token("--glass-filter")).toMatch(/saturate\(1\.\d+\)/);
    expect(token("--glass-bg")).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0?\.\d+\)$/);
    expect(token("--dim-bg")).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0?\.\d+\)$/);
    expect(token("--dim-filter")).toMatch(/blur\(\d+px\)/);
  });

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
