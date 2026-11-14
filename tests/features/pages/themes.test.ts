import { describe, expect, it } from "vitest";
import {
  arrange,
  coloursOf,
  DEFAULT_THEME,
  MIN_CONTRAST,
  offeredTheme,
  THEMES,
  themeById,
} from "../../../src/features/pages/themes.ts";
import { contrast } from "../../../src/lib/colour.ts";

// Which of the book's 348 combinations a maker may pick (design 5.3, 10): only those whose colours can be
// given four jobs, text on ground and a label on a button, and both read at 4.5:1 or more.

const BLACK_AND_WHITE = { ground: "#000000", text: "#ffffff", button: "#ffffff", buttonText: "#000000" };
const offeredIds = new Set(THEMES.map((theme) => theme.id));

describe("arrange", () => {
  it("gives two readable colours each other's jobs", () => {
    expect(arrange(["#000000", "#ffffff"])).toEqual(BLACK_AND_WHITE);
  });

  it("offers nothing when no pair is readable", () => {
    expect(arrange(["#777777", "#888888"])).toBeNull();
    expect(arrange(["#777777", "#888888", "#808080"])).toBeNull();
  });

  it("picks the most readable pair for the text, whatever order the colours come in", () => {
    const colours = ["#888888", "#000000", "#ffffff"];
    const arranged = arrange(colours);
    expect(contrast(arranged?.text ?? "", arranged?.ground ?? "")).toBe(21);
    expect(arranged).toEqual(BLACK_AND_WHITE);
  });

  it("settles a tie by the order the colours are given in", () => {
    // Black on white and white on black read the same; the first colour given is the ground.
    expect(arrange(["#ffffff", "#000000"])).toEqual({
      ground: "#ffffff",
      text: "#000000",
      button: "#000000",
      buttonText: "#ffffff",
    });
  });
});

describe("the offered themes", () => {
  it("holds some", () => {
    expect(THEMES.length).toBeGreaterThan(0);
  });

  it("never uses one colour for a thing and what is written on it", () => {
    for (const theme of THEMES) {
      expect(theme.text, `combination ${String(theme.id)}`).not.toBe(theme.ground);
      expect(theme.button, `combination ${String(theme.id)}`).not.toBe(theme.ground);
      expect(theme.buttonText, `combination ${String(theme.id)}`).not.toBe(theme.button);
    }
  });

  // Review Focus 8: every offered combination, not a sample.
  it("is readable in every one: its text, and its button's label", () => {
    for (const theme of THEMES) {
      expect(contrast(theme.text, theme.ground), `combination ${String(theme.id)}`).toBeGreaterThanOrEqual(
        MIN_CONTRAST,
      );
      expect(
        contrast(theme.buttonText, theme.button),
        `combination ${String(theme.id)}`,
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("leaves out every combination that has no readable arrangement", () => {
    for (let id = 1; id <= 348; id += 1) {
      if (!offeredIds.has(id)) expect(arrange(coloursOf(id)), `combination ${String(id)}`).toBeNull();
    }
  });

  it("lists them in number order, each once", () => {
    const ids = THEMES.map((theme) => theme.id);
    expect(ids).toEqual([...new Set(ids)].sort((a, b) => a - b));
  });

  it("uses only its own combination's colours", () => {
    for (const theme of THEMES) {
      const label = `combination ${String(theme.id)}`;
      expect(theme.colours, label).toEqual(coloursOf(theme.id));
      for (const hex of [theme.ground, theme.text, theme.button, theme.buttonText]) {
        expect(theme.colours, label).toContain(hex);
      }
    }
  });

  it("says how many are offered", () => {
    // The number is read from the run's log and written in the tracker: a fact is measured, not typed.
    console.log(`offered themes: ${String(THEMES.length)} of 348`);
  });
});

describe("choosing a theme", () => {
  // Review Focus 7: a number posted by hand that is not offered.
  it("refuses a number that is not offered", () => {
    for (const id of [0, -1, 349, 1.5, Number.NaN]) expect(offeredTheme(id), String(id)).toBeNull();
    expect(themeById(349)).toBe(DEFAULT_THEME);
  });

  it("finds an offered one by its number", () => {
    const first = THEMES[0];
    expect(first).toBeDefined();
    expect(offeredTheme(first?.id ?? 0)).toBe(first);
    expect(themeById(first?.id ?? 0)).toBe(first);
  });

  it("wears the default theme for number 0", () => {
    expect(themeById(0)).toBe(DEFAULT_THEME);
  });

  it("has a default theme that is readable too", () => {
    expect(contrast(DEFAULT_THEME.text, DEFAULT_THEME.ground)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrast(DEFAULT_THEME.buttonText, DEFAULT_THEME.button)).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
