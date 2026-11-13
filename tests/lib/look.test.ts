import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, lookCss, rgb, token } from "../support/look-tokens.ts";

// The look (design 5.8) is plain CSS custom properties. These tests read the stylesheet itself, so a token
// that is renamed, dropped or changed to a hard-to-read pair fails here before it reaches a page.

const css = lookCss();
const fontFile = (name: string) => readFileSync(`static/fonts/${name}`);

describe("the tokens (design 5.8)", () => {
  it.each([
    ["--felt", "#1c3a2f"],
    ["--felt-deep", "#142c23"],
    ["--felt-raised", "#25483a"],
    ["--chalk", "#eef2ec"],
    ["--sage", "#a8bfb2"],
    ["--paper", "#f1efe9"],
    ["--ink", "#191b1a"],
    ["--ink-soft", "#4a504c"],
    ["--pip", "#c43b26"],
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
    ["--radius-button", "9999px"],
    ["--size-target", "48px"],
    ["--width-read", "40rem"],
    ["--press-scale", "0.97"],
    ["--press-time", "160ms"],
  ])("%s is %s", (name, value) => {
    expect(token(name)).toBe(value);
  });

  it("names Young Serif and Schibsted Grotesk first, each with a system font behind it", () => {
    expect(token("--font-display")).toMatch(/^"Young Serif", .*serif$/);
    expect(token("--font-text")).toMatch(/^"Schibsted Grotesk", .*system-ui.*sans-serif$/);
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
    ["--paper", "--pip"], // the one paid action
  ])("%s on %s reaches 4.5:1", (text, ground) => {
    expect(contrast(token(text), token(ground))).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["--ink-soft", "--paper"], // a field's edge
    ["--paper", "--felt"], // the focus ring, the card and the main button on felt
    ["--pip", "--paper"], // the paid button against its card
  ])("%s shows against %s (3:1)", (mark, ground) => {
    expect(contrast(token(mark), token(ground))).toBeGreaterThanOrEqual(3);
  });

  it("is measured the way WCAG measures it", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(rgb("#1c3a2f")).toBe("rgb(28, 58, 47)");
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
