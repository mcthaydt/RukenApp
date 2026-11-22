import { feedServices } from "../../features/feed/feed.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../features/membership/membership.ts";
import { MORE } from "./sections.ts";
import type { PageServerLoad } from "./$types";

// The landing page: what Ruken is, for players and makers. Its words are in sections.ts; the server gives it the one
// thing that changes by itself (the clip at the top of the feed, as the picture of the product) and the price, from the
// rules (plans.ts), never typed on the page.
//
// The short sections lower down each carry a still from a live game: the next games in the feed's order, one each,
// starting again from the top when the feed has fewer. With no live game they have none.
export const load: PageServerLoad = async ({ locals }) => {
  const clips = await feedServices().service.feed();
  const [top] = clips;
  return {
    clip: top === undefined ? null : { slug: top.slug, name: top.name, upright: top.upright },
    stills: MORE.map((_, index) => {
      const game = clips.length === 0 ? undefined : clips[(index + 1) % clips.length];
      // Each a different moment (3, 7 and 11 seconds in), so one game in the feed still gives three pictures.
      return game === undefined ? null : { name: game.name, wide: game.wide, at: 3 + index * 4 };
    }),
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: locals.caller.kind === "user",
  };
};
