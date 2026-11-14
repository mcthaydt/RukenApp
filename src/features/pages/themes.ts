// How a maker's page is coloured: the book's colours, and which of its combinations make a readable page.
// Pure data and arithmetic, so a browser may bundle it (the colour picker) as well as the server.
import { contrast } from "../../lib/colour.ts";
import colours from "./library/colours.json" with { type: "json" };

/** One of the book's colours: its name, its `#rrggbb`, and the numbers of the combinations it is in. */
export interface WadaColour {
  name: string;
  hex: string;
  combinations: number[];
}

/**
 * All 159 of the book's colours, in the data file's order. Only the three keys a page needs are kept: the
 * file also holds print and screen measurements (cmyk, lab, rgb) that nothing here reads.
 */
export const WADA_COLOURS: readonly WadaColour[] = colours.map(({ name, hex, combinations }) => ({
  name,
  hex,
  combinations,
}));

/** The hex of each colour in a combination, in the data file's order; empty for a number the book lacks. */
export function coloursOf(combination: number): string[] {
  return WADA_COLOURS.filter((colour) => colour.combinations.includes(combination)).map(
    (colour) => colour.hex,
  );
}

/** The least contrast, as WCAG's ratio, between any text and what it sits on (design 5.3: readable or not offered). */
export const MIN_CONTRAST = 4.5;

/** The four jobs a page gives its colours. */
export interface Arrangement {
  ground: string;
  text: string;
  button: string;
  buttonText: string;
}

/**
 * The best way to give a combination's colours their four jobs, or null when no way is readable.
 *
 * Every way is tried (at most four colours, so at most 256). A way's score is the weaker of its two pairs, the
 * text on the ground and the label on the button, so one good pair cannot hide a bad one. The first way found
 * wins a tie, looking through the colours in their given order for the ground, then the text, then the button,
 * then the label: the same combination always gives the same page.
 */
export function arrange(colours: readonly string[]): Arrangement | null {
  let best: Arrangement | null = null;
  let bestScore = 0;
  for (const ground of colours) {
    for (const text of colours) {
      if (text === ground) continue;
      for (const button of colours) {
        if (button === ground) continue;
        for (const buttonText of colours) {
          if (buttonText === button) continue;
          const score = Math.min(contrast(text, ground), contrast(buttonText, button));
          if (score > bestScore) {
            best = { ground, text, button, buttonText };
            bestScore = score;
          }
        }
      }
    }
  }
  return bestScore >= MIN_CONTRAST ? best : null;
}

/** An arrangement of one of the book's combinations, by its number, with all the combination's colours. */
export interface Theme extends Arrangement {
  id: number;
  colours: string[];
}

/** The book has 348 combinations, numbered from 1. */
const COMBINATION_COUNT = 348;

/** Every combination that has a readable arrangement, in number order. */
export const THEMES: readonly Theme[] = Array.from({ length: COMBINATION_COUNT }, (_, index) => {
  const id = index + 1;
  const combination = coloursOf(id);
  const arranged = arrange(combination);
  return arranged === null ? null : { id, colours: combination, ...arranged };
}).filter((theme) => theme !== null);

/** The Card Table's own colours (felt, chalk, paper, ink): what a page wears until its maker picks a theme. */
export const DEFAULT_THEME: Theme = {
  id: 0,
  colours: ["#112f2c", "#ffffff"],
  ground: "#112f2c",
  text: "#ffffff",
  button: "#ffffff",
  buttonText: "#111314",
};

/** The offered theme with this number, or null for anything else, a made-up number included. */
export function offeredTheme(id: number): Theme | null {
  return THEMES.find((theme) => theme.id === id) ?? null;
}

/** The offered theme with this number, or the default theme. */
export function themeById(id: number): Theme {
  return offeredTheme(id) ?? DEFAULT_THEME;
}
