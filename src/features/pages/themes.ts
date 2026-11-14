// How a maker's page is coloured: the book's colours, and which of its combinations make a readable page.
// Pure data and arithmetic, so a browser may bundle it (the colour picker) as well as the server.

/** One of the book's colours: its name, its `#rrggbb`, and the numbers of the combinations it is in. */
export interface WadaColour {
  name: string;
  hex: string;
  combinations: number[];
}

/** All 159 of the book's colours, in the data file's order. */
export const WADA_COLOURS: readonly WadaColour[] = [];

/** The hex of each colour in a combination, in the data file's order; empty for a number the book lacks. */
export function coloursOf(combination: number): string[] {
  throw new Error(`not built yet: coloursOf ${String(combination)}`);
}
