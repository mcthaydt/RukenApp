import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { lookCss, token } from "../support/look-tokens.ts";

// Ruken's own corner (the owner, 2026-11-24: "a long ease to all corner curves ... twice as far out, then melt into
// the edge ... our curved corners don't look like other people's"). One shape and one set of reaches, in
// src/lib/look.css; every rounded corner in every style sheet and component reads them. Read as text; nothing here
// draws (tests/browser/corners.test.ts looks at the drawn corners).

const ROOT = join(import.meta.dirname, "../..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

/** Every CSS rule in every style sheet and component, as [path, selector, body], comments dropped. */
const rules: [string, string, string][] = files(join(ROOT, "src"))
  .filter((path) => /\.(css|svelte)$/.test(path))
  .flatMap((path) => {
    const text = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      (match) => [relative(ROOT, path), (match[1] ?? "").trim(), match[2] ?? ""] as [string, string, string],
    );
  });

const RADIUS_TOKENS = [
  "--radius-card",
  "--radius-field",
  "--radius-button",
  "--radius-small",
  "--radius-tiny",
];

/** True when every part of a border-radius value is 0, `inherit`, or built from a radius token. */
function readsTheTokens(value: string): boolean {
  const withoutTokens = value
    .replace(/var\(--radius-(card|field|button|small|tiny)\)/g, "R")
    .replace(/calc\([^;]*\)/g, (calc) => (calc.includes("R") ? "R" : calc));
  return withoutTokens.split(/\s+/).every((part) => part === "R" || part === "0" || part === "inherit");
}

describe("Ruken's corners", () => {
  it("draw every corner in Ruken's soft shape, on every element", () => {
    expect(token("--corner-shape")).toBe("superellipse(1.4)");
    const everything = rules.find(
      ([path, selector]) =>
        path.endsWith("look.css") && selector.replace(/\s+/g, " ") === "*, *::before, *::after",
    );
    expect(everything?.[2]).toMatch(/corner-shape:\s*var\(--corner,\s*var\(--corner-shape\)\)/);
  });

  it("reach twice as far as the old round corners (20, 14, 12, 8 and 4px)", () => {
    expect([token("--radius-card"), token("--radius-field"), token("--radius-button")]).toEqual([
      "40px",
      "28px",
      "24px",
    ]);
    expect([token("--radius-small"), token("--radius-tiny")]).toEqual(["16px", "8px"]);
  });

  it("make a button's corners meet in the middle, so it is nearly a pill", () => {
    // A button is at least --size-target tall; corners reaching half of that take its whole end.
    expect(Number.parseFloat(token("--radius-button")) * 2).toBeGreaterThanOrEqual(
      Number.parseFloat(token("--size-target")),
    );
  });

  it("fall back to plain round corners at about four fifths of the reach where the shape cannot be drawn", () => {
    const fallback = /@supports not \(corner-shape: superellipse\(1\.4\)\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(
      lookCss(),
    );
    expect(fallback).not.toBeNull();
    for (const name of RADIUS_TOKENS) {
      const round = new RegExp(`${name}:\\s*(\\d+)px`).exec(fallback?.[1] ?? "")?.[1];
      expect(round, `${name} in the fallback`).toBeDefined();
      const share = Number(round) / Number.parseFloat(token(name));
      expect(share, name).toBeGreaterThanOrEqual(0.75);
      expect(share, name).toBeLessThanOrEqual(0.85);
    }
  });

  it("come only from the tokens, in every style sheet and component", () => {
    const own: string[] = [];
    for (const [path, selector, body] of rules) {
      for (const match of body.matchAll(/(?:^|[;\s])border(?:-[a-z]+)*-radius\s*:\s*([^;]+)/g)) {
        const value = (match[1] ?? "").trim();
        if (value === "50%") continue; // a true circle, checked below
        if (!readsTheTokens(value)) own.push(`${path} ${selector}: ${value}`);
      }
    }
    expect(own).toEqual([]);
  });

  it("keep a true circle round", () => {
    const squircled = rules
      .filter(([, , body]) => /border-radius:\s*50%/.test(body) && !/--corner:\s*round/.test(body))
      .map(([path, selector]) => `${path} ${selector}`);
    expect(squircled).toEqual([]);
  });
});
