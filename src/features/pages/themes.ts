// How a maker's page is coloured: the book's colours, and which of its combinations make a readable page.
// Pure data and arithmetic, so a browser may bundle it (the colour picker) as well as the server.
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

/** The best way to give a combination's colours their four jobs, or null when no way is readable. */
export function arrange(colours: readonly string[]): Arrangement | null {
  throw new Error(`not built yet: arrange ${String(colours.length)}`);
}

/** An arrangement of one of the book's combinations, by its number, with all the combination's colours. */
export interface Theme extends Arrangement {
  id: number;
  colours: string[];
}

/** Every combination that has a readable arrangement, in number order. */
export const THEMES: readonly Theme[] = [];

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
  throw new Error(`not built yet: offeredTheme ${String(id)}`);
}

/** The offered theme with this number, or the default theme. */
export function themeById(id: number): Theme {
  throw new Error(`not built yet: themeById ${String(id)}`);
}
