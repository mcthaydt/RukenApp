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
