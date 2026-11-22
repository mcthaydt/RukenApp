import { feedServices, type FeedClip } from "../../features/feed/feed.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../features/membership/membership.ts";
import type { PageServerLoad } from "./$types";

// The landing page: what Ruken is, for players and makers. Its words are in sections.ts; the server gives it what changes by
// itself (the live games, as the pictures of the product) and the price, from the rules (plans.ts), never typed on
// the page.
//
// The first screen is a wall of live games' clips: three columns of two, the feed's own clips in its order along the
// top row first, so every live game shows before any repeats. A short feed fills the rest with the same games, each
// repeat starting at another moment. Lower down, "Bring your fans" shows the first maker's page and "Safe to
// play" the feed on a phone, both from the live games. With no live game the page has none of these pictures.
/** The wall's columns, and the clips in each. */
const WALL_COLUMNS = 3;
const WALL_ROWS = 2;

/** Beside "Bring your fans": the first maker in the feed's order, with their live games (at most three), as their page shows them. */
function makerPage(clips: readonly FeedClip[]) {
  const maker = clips.find((clip) => clip.maker !== null)?.maker;
  if (maker === undefined || maker === null) return null;
  const games = clips.filter((clip) => clip.maker?.handle === maker.handle).slice(0, 3);
  return { ...maker, games: games.map((game) => ({ name: game.name, upright: game.upright })) };
}

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
    // The feed on a phone, as "Safe to play" shows it: the top clip with its name and maker, as the feed shows them.
    feed: top === undefined ? null : { name: top.name, maker: top.maker?.name ?? null, upright: top.upright },
    maker: makerPage(clips),
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: locals.caller.kind === "user",
  };
};
