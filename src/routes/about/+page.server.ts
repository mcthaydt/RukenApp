import { feedServices } from "../../features/feed/feed.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../features/membership/membership.ts";
import { MORE } from "./sections.ts";
import type { PageServerLoad } from "./$types";

// The landing page: what Ruken is, for players and makers. Its words are in sections.ts; the server gives it the one
// thing that changes by itself (the clip at the top of the feed, as the picture of the product) and the price, from the
// rules (plans.ts), never typed on the page.
//
// The first screen is a wall of live games' clips: three columns of two, the feed's own clips in its order along the
// top row first, so every live game shows before any repeats. A short feed fills the rest with the same games, each
// repeat starting at another moment. The short sections lower down each play a live game's clip too: the next games in
// the feed's order, one each, starting again from the top when the feed has fewer. With no live game the page has no
// clips at all.
/** The wall's columns, and the clips in each. */
const WALL_COLUMNS = 3;
const WALL_ROWS = 2;

export const load: PageServerLoad = async ({ locals }) => {
  const clips = await feedServices().service.feed();
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
    stills: MORE.map((_, index) => {
      const game = clips.length === 0 ? undefined : clips[(index + 1) % clips.length];
      // Each starts at a different moment (3, 7 and 11 seconds in), so one game in the feed still gives three pictures.
      return game === undefined ? null : { name: game.name, wide: game.wide, at: 3 + index * 4 };
    }),
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: locals.caller.kind === "user",
  };
};
