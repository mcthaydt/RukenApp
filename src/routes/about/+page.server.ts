import { feedServices } from "../../features/feed/feed.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../features/membership/membership.ts";
import { pageEditorOpen } from "../../features/pages/pages.ts";
import type { PageServerLoad } from "./$types";

// The landing page: what Ruken is, for players and makers. Its words are in sections.ts; the server gives it what changes by
// itself (the live games, as the pictures of the product) and the price, from the rules (plans.ts), never typed on
// the page.
//
// The first screen is a wall of live games' clips: three columns of two, the feed's own clips in its order along the
// top row first, so every live game shows before any repeats. A short feed fills the rest with the same games, each
// repeat starting at another moment. With no live game the page has no clips.
/** The wall's columns, and the clips in each. */
const WALL_COLUMNS = 3;
const WALL_ROWS = 2;

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const { clips } = await feedServices().service.page(null);
  const [top] = clips;
  return {
    wall:
      top === undefined
        ? []
        : Array.from({ length: WALL_COLUMNS }, (_, column) =>
            Array.from({ length: WALL_ROWS }, (_, row) => {
              // Along the top row first, so a feed of three shows all three before any repeats.
              const slot = row * WALL_COLUMNS + column;
              const game = clips[slot % clips.length] ?? top;
              return { upright: game.upright, at: 2 + Math.floor(slot / clips.length) * 4 };
            }),
          ),
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: locals.caller.kind === "user",
    // The section about a maker's own page waits for the Pages slice with the editor (sections.ts, "fans").
    pageEditor: pageEditorOpen(cookies),
  };
};
