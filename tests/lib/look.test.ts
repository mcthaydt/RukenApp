import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, lookCss, rgb, token } from "../support/look-tokens.ts";

// The look (design 5.8) is plain CSS custom properties. These tests read the stylesheet itself, so a token
// that is renamed, dropped or changed to a hard-to-read pair fails here before it reaches a page.

const css = lookCss();
const fontFile = (name: string) => readFileSync(`static/fonts/${name}`);

describe("the tokens (design 5.8)", () => {
  // The nearest colours in A Dictionary of Color Combinations (Owner, 2026-11-14); design 5.8 names each.
  it.each([
    ["--felt", "#112f2c"], // Deep Slate Green
    ["--felt-deep", "#111314"], // Black
    ["--felt-raised", "#004f46"], // Dusky Green
    ["--chalk", "#ffffff"], // White
    ["--sage", "#b4cdc2"], // Glaucous Green
    ["--paper", "#ffffff"], // White
    ["--ink", "#111314"], // Black
    ["--ink-soft", "#34454c"], // Slate Color
    ["--pip", "#cb2f43"], // Scarlet
    ["--pay", "#006eb8"], // Blue
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it.each([
    ["--text-section", "400 2.25rem/1 var(--font-display)"], // 36px, a phone
    ["--text-section-wide", "400 4rem/1 var(--font-display)"], // 64px
    ["--text-card-title", "400 2rem/1.1 var(--font-display)"], // 32px
    ["--text-statement", "400 1.5rem/1.2 var(--font-display)"], // 24px
    ["--text-body", "400 1.125rem/1.55 var(--font-text)"], // 18px at 1.55
    ["--text-small", "400 0.875rem/1.45 var(--font-text)"], // 14px
    ["--text-button", "600 1.125rem/1.2 var(--font-text)"],
    ["--radius-card", "20px"],
    ["--radius-field", "14px"],
    ["--radius-button", "12px"], // buttons are rounded squares, not pills (Owner, 2026-11-14)
    ["--size-target", "48px"],
    ["--width-read", "40rem"],
    ["--press-scale", "0.97"],
    ["--press-time", "160ms"],
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it("names the colours' source, the Dictionary of Color Combinations data set, in a comment", () => {
    expect(css).toMatch(/dictionary-of-colour-combinations/);
    expect(css).toMatch(/MIT/);
    expect(css).toMatch(/Matt DesLauriers/);
  });

  // AGENTS.md: files from others keep their own licences beside them, as the fonts' do.
  it("keeps that data set's MIT licence beside the stylesheet, and the comment points at it", () => {
    const name = "dictionary-of-colour-combinations-LICENSE.txt";
    const licence = readFileSync(`src/lib/${name}`, "utf8");
    expect(licence).toMatch(/^The MIT License \(MIT\)\nCopyright \(c\) 2020 Matt DesLauriers\n/);
    expect(licence).toContain("Permission is hereby granted, free of charge");
    expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND');
    expect(css).toContain(name);
  });

  it("names Young Serif and Schibsted Grotesk first, each with a system font behind it", () => {
    expect(token("--font-display")).toMatch(/^"Young Serif", .*serif$/);
    expect(token("--font-text")).toMatch(/^"Schibsted Grotesk", .*system-ui.*sans-serif$/);
  });

  // The Owner, 2026-11-14, "I want it to stand out, but red seems bad", then "go with D": the paid button is Blue with
  // white words, and no rule paints the pip red (it is the paywall card's one small mark, not built yet).
  it("paints the paid button Blue with white words, and no rule uses the pip red", () => {
    const pay = /\.card \.pay\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(pay).toMatch(/background:\s*var\(--pay\);/);
    expect(pay).toMatch(/color:\s*var\(--chalk\);/);
    expect(css).not.toMatch(/var\(--pip\)/);
  });

  it("is one dark theme, with none of what the design rules out", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark;/);
    expect(css).not.toMatch(
      /gradient\(|box-shadow|text-shadow|backdrop-filter|text-transform|letter-spacing/,
    );
  });
});

describe("contrast, measured from the tokens (WCAG AA)", () => {
  it.each([
    ["--chalk", "--felt"],
    ["--chalk", "--felt-deep"],
    ["--chalk", "--felt-raised"],
    ["--sage", "--felt"],
    ["--sage", "--felt-deep"],
    ["--ink", "--paper"],
    ["--ink-soft", "--paper"],
    ["--paper", "--ink"], // the main button on a card
    ["--paper", "--pip"], // the pip mark's words, if it ever has any
    ["--chalk", "--pay"], // the paid button
  ])("%s on %s reaches 4.5:1", (text, ground) => {
    expect(contrast(token(text), token(ground))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["--ink", "--paper"], // a field's edge
    ["--paper", "--felt"], // the focus ring, the card and the main button on felt
    ["--pip", "--paper"], // the old red button against its card
    ["--pay", "--paper"], // the paid button against its card
  ])("%s shows against %s (3:1)", (mark, ground) => {
    expect(contrast(token(mark), token(ground))).toBeGreaterThanOrEqual(3);
  });

  // The ratios design 5.8 prints beside each colour, to one decimal. They are measured here, from the tokens.
  it.each([
    ["--chalk", "--felt", "14.3"],
    ["--sage", "--felt", "8.5"],
    ["--ink", "--paper", "18.6"],
    ["--ink-soft", "--paper", "10.0"],
    ["--paper", "--pip", "5.2"],
    ["--chalk", "--pay", "5.4"], // the paid button's words
  ])("%s on %s measures %s:1, as design 5.8 says", (text, ground, ratio) => {
    expect(contrast(token(text), token(ground)).toFixed(1)).toBe(ratio);
  });

  it("is measured the way WCAG measures it", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(rgb("#112f2c")).toBe("rgb(17, 47, 44)");
  });
});

describe("the fonts", () => {
  const WOFF2 = [
    "young-serif-latin-400-normal.woff2",
    "schibsted-grotesk-latin-400-normal.woff2",
    "schibsted-grotesk-latin-600-normal.woff2",
  ];
  const LICENCES = ["young-serif-LICENSE.txt", "schibsted-grotesk-LICENSE.txt"];
  const sources = () =>
    JSON.parse(fontFile("sources.json").toString("utf8")) as Record<
      string,
      { bytes: number; sha256: string; integrity: string; tarball: string }
    >;

  it("are three faces, each from a file on Ruken's own address", () => {
    const urls = [...css.matchAll(/src:\s*url\("(.*?)"\)/g)].map((match) => match[1]);
    expect(urls).toEqual(WOFF2.map((name) => `/fonts/${name}`));
    for (const name of WOFF2) expect(fontFile(name).subarray(0, 4).toString("latin1")).toBe("wOF2");
  });

  it("have their licences beside them", () => {
    for (const name of LICENCES) expect(fontFile(name).toString("utf8")).toContain("SIL Open Font License");
  });

  it("are the files sources.json says they are, and the folder holds nothing else", () => {
    expect(readdirSync("static/fonts").sort()).toEqual([...WOFF2, ...LICENCES, "sources.json"].sort());
    expect(Object.keys(sources()).sort()).toEqual([...WOFF2, ...LICENCES].sort());
    for (const [name, source] of Object.entries(sources())) {
      expect(fontFile(name).length).toBe(source.bytes);
      expect(createHash("sha256").update(fontFile(name)).digest("hex")).toBe(source.sha256);
      expect(source.integrity).toMatch(/^sha512-/);
      expect(source.tarball).toMatch(/^https:\/\/registry\.npmjs\.org\/@fontsource\//);
    }
  });

  it("ask nothing of another site, and add no package", () => {
    expect(css).not.toMatch(/https?:|@import/);
    expect(readFileSync("package.json", "utf8")).not.toContain("fontsource");
  });
});

// Screens are plain elements and the look's few classes; they carry no colour, size or style of their own.
describe("screens wear the look and nothing of their own", () => {
  const CLASSES = [
    "card",
    "statement",
    "note",
    "row",
    "button",
    "quiet",
    "pay",
    "problem",
    "wordmark",
    "panel",
    "choice",
    "apart",
    "clip",
    "frame",
  ];
  const ROUTES = "src/routes";

  /** Every .svelte file under src/routes, as a path from the repository's root. */
  const screens = readdirSync(ROUTES, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svelte"))
    .map((entry) => join(entry.parentPath, entry.name));

  const classNamesOf = (text: string) =>
    [...text.matchAll(/class="([^"]*)"/g)].flatMap((match) => (match[1] ?? "").split(/\s+/).filter(Boolean));

  /** The screens with a class="..." that holds `name` as a whole name ("pay", never a part of a longer word). */
  const screensUsing = (name: string) =>
    screens.filter((file) => classNamesOf(readFileSync(file, "utf8")).includes(name));

  it("no screen has a style block, a style attribute or a colour", () => {
    expect(screens.length).toBeGreaterThan(0);
    for (const file of screens) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/<style|style=|rgb\(|hsl\(|(?<!&)#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i);
    }
  });

  it("every class a screen uses is one of the look's, written out plainly", () => {
    for (const file of screens) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/class=\{|class:/);
      for (const name of classNamesOf(text)) expect(CLASSES, file).toContain(name);
    }
  });

  it("the paid button is used once, on the paywall card", () => {
    // It is the one press that spends money, so it is the one button with this class on the whole site.
    expect(screensUsing("pay")).toEqual([join(ROUTES, "join", "+page.svelte")]);
    const card = readFileSync(join(ROUTES, "join", "+page.svelte"), "utf8");
    expect(card.match(/class="pay"/g)).toHaveLength(1);
  });
});

// A game's clips and its frame (design 5.8, Task 19). Each class has its rule here and its first use in the staff page
// (Task 30); a game's own screens (Task 21) add a rule for `frame` inside the play screen.
describe("a game's clips and its frame", () => {
  /** The declarations of the rule whose whole selector is `.name`, with comments dropped so one cannot fake a rule. */
  const ruleOf = (name: string): string => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    return new RegExp(`(?:^|\\})\\s*\\.${name}\\s*\\{([^}]*)\\}`).exec(withoutComments)?.[1] ?? "";
  };

  it("clip is as wide as its space, at most 60% of the window's height, with rounded corners and ink behind it", () => {
    const clip = ruleOf("clip");
    expect(clip).toMatch(/display:\s*block/);
    expect(clip).toMatch(/width:\s*100%/);
    expect(clip).toMatch(/max-height:\s*60dvh/);
    expect(clip).toMatch(/border-radius:\s*var\(--radius-card\)/);
    expect(clip).toMatch(/background:\s*var\(--ink\)/);
    expect(clip).toMatch(/object-fit:\s*cover/);
  });

  it("frame is as wide as its space, 70% of the window's height, with no edge and felt-deep behind it", () => {
    const frame = ruleOf("frame");
    expect(frame).toMatch(/display:\s*block/);
    expect(frame).toMatch(/width:\s*100%/);
    expect(frame).toMatch(/height:\s*70dvh/);
    expect(frame).toMatch(/border:\s*0/);
    expect(frame).toMatch(/background:\s*var\(--felt-deep\)/);
  });

  it("uses only the look's tokens: no colour is written into either rule", () => {
    for (const name of ["clip", "frame"])
      expect(ruleOf(name), name).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    // An empty rule would pass that check, so each must exist.
    expect(ruleOf("clip")).not.toBe("");
    expect(ruleOf("frame")).not.toBe("");
  });
});
