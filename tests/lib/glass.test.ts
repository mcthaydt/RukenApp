import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { lookCss, token } from "../support/look-tokens.ts";

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
  /(?:rgba|hsla)\(|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\((?:[^()]|\([^()]*\))*\/|#(?:[0-9a-f]{4}|[0-9a-f]{8})\b|(?:color-mix|-gradient)\([^;]*\btransparent\b/i;

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
    ["background: linear-gradient(to top, var(--felt-deep), transparent);"],
    ["background-image: linear-gradient(transparent, var(--felt-deep));"],
    ["background-color: oklch(from var(--felt-deep) l c h / 0.5);"],
    ["background: rgb(from var(--felt-deep) r g b / 50%);"],
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
    ["background: oklch(0.2 0.01 200);"],
    ["background-image: url(/images/felt.png);"],
    ["background: var(--spinner-turning) center / min(40px, 50%) no-repeat var(--felt-raised);"],
    ["background-image: linear-gradient(var(--felt), var(--felt-deep));"],
    ['background: url("/a/b.png") center / cover;'],
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

  // The owner, 2026-11-22 21:45 to 21:47 UTC: the glass is "a lot more transparent", and darkens what is behind it by
  // "like 5%", then "maybe 10". A white clip behind, darkened by the filter and then under the tint, comes out between
  // 5% and 12% darker: clear, and never the near-black it was.
  it("darkens what is behind by about a tenth", () => {
    const brightness = Number(/brightness\(([\d.]+)\)/.exec(token("--glass-filter"))?.[1]);
    const [red = 0, , , alpha = 1] = (token("--glass-bg").match(/[\d.]+/g) ?? []).map(Number);
    const white = 255;
    const after = alpha * red + (1 - alpha) * white * brightness;
    const darker = 1 - after / white;
    expect(darker).toBeGreaterThanOrEqual(0.05);
    expect(darker).toBeLessThanOrEqual(0.12);
  });

  // Glass that clear cannot keep chalk at 4.5 to 1 over a white clip by darkening alone, so the words and pictures on it
  // carry a soft dark shadow, and its edge splits light like a lens ("it also lacks chromatic abberation"): every glass
  // surface reads the edge, and the edge holds a warm and a cool fringe.
  it("gives every glass surface the lens edge, with a warm and a cool fringe", () => {
    const found: string[] = [];
    for (const [path, selector, body] of rules) {
      if (
        /(?:^|[;\s])background\s*:\s*var\(--glass-bg\)/.test(body) &&
        !/box-shadow\s*:\s*var\(--glass-edge\)/.test(body)
      )
        found.push(`${path} ${selector}`);
    }
    expect(found).toEqual([]);
    const fringes = [...token("--glass-edge").matchAll(/rgb\((\d+) (\d+) (\d+)/g)].map((m) =>
      m.slice(1).map(Number),
    );
    expect(
      fringes.some(([r = 0, , b = 0]) => r > 200 && b < 128),
      "a warm fringe",
    ).toBe(true);
    expect(
      fringes.some(([r = 0, , b = 0]) => r < 128 && b > 200),
      "a cool fringe",
    ).toBe(true);
    expect(token("--glass-ink")).toMatch(/rgb\(0 0 0 \/ 0?\.\d+\)/);
    expect(token("--glass-icon")).toMatch(/^drop-shadow\(/);
  });

  it("falls back to the solid darkest felt, with no edge or shadow, where there is no blur, less see-through or more contrast", () => {
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
      expect(block).toContain("--glass-edge: none;");
      expect(block).toContain("--glass-ink: none;");
      expect(block).toContain("--glass-icon: none;");
      expect(block).toContain("--dim-filter: none;");
      expect(block).toContain("--glass-pay: var(--pay);");
      expect(block).toContain("--glass-safe: var(--felt-raised);");
      expect(block).toContain("--glass-lift: var(--felt-raised);");
    }
  });

  // The owner chose coloured glass buttons (2026-11-23): a button on glass is glass tinted strongly in its own colour,
  // so it stays plainly the blue or the green it is, and still reads as one thing to press.
  it("tints the glass buttons in the button's own colour, strongly enough to stay that colour", () => {
    const hex = (name: string) => {
      const value = token(name).replace("#", "");
      return [0, 2, 4].map((at) => Number.parseInt(value.slice(at, at + 2), 16)).join(" ");
    };
    for (const [glass, solid] of [
      ["--glass-pay", "--pay"],
      ["--glass-safe", "--felt-raised"],
    ] as const) {
      const match = /^rgb\((\d+ \d+ \d+) \/ (0?\.\d+)\)$/.exec(token(glass));
      expect(match, glass).not.toBeNull();
      expect(match?.[1], `${glass} is ${solid}`).toBe(hex(solid));
      expect(Number(match?.[2]), `${glass} is mostly its colour`).toBeGreaterThanOrEqual(0.75);
    }
  });

  // Glass only over moving content (the owner, 2026-11-27: "The glass button effect should not be for pages with a
  // static color background"). What moves marks itself with `data-glass`; a page with nothing marked draws every glass
  // token solid, in the same colours, with no edge, halo or blur.
  it("is solid on a page where nothing behind it moves", () => {
    const css = lookCss();
    const at = css.indexOf(":root:not(:has([data-glass])) {");
    expect(at, "the plain-page block in look.css").toBeGreaterThanOrEqual(0);
    const block = css.slice(at, css.indexOf("}", at));
    for (const line of [
      "--glass-bg: var(--felt-deep);",
      "--glass-filter: none;",
      "--glass-edge: none;",
      "--glass-ink: none;",
      "--glass-icon: none;",
      "--glass-pay: var(--pay);",
      "--glass-safe: var(--felt-raised);",
      "--glass-lift: var(--felt-raised);",
    ])
      expect(block, line).toContain(line);
  });

  it("is marked only on what moves: the feed's clips, a game's page, the play screen, a live game's video and a clip behind Join", () => {
    const marked = sources
      .filter(([, text]) => /\sdata-glass(?=[\s>=])/.test(text))
      .map(([path]) => path)
      .sort();
    expect(marked).toEqual([
      "src/features/feed/Feed.svelte",
      "src/features/play/PlayScreen.svelte",
      "src/routes/g/[game]/+page.svelte",
      "src/routes/join/+page.svelte",
      "src/routes/make/parts/GameBackdrop.svelte",
    ]);
  });
});
