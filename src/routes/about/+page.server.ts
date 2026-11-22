import { feedServices } from "../../features/feed/feed.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../features/membership/membership.ts";
import type { PageServerLoad } from "./$types";

// The landing page: what Ruken is, for players and makers. Its words are in sections.ts; the server gives it the one
// thing that changes by itself (the clip at the top of the feed, as the picture of the product) and the price, from the
// rules (plans.ts), never typed on the page.
export const load: PageServerLoad = async ({ locals }) => {
  const [top] = await feedServices().service.feed();
  return {
    clip: top === undefined ? null : { slug: top.slug, name: top.name, upright: top.upright },
    prices: { monthly: dollars(PREMIUM_PRICES_CENTS.monthly), annual: dollars(PREMIUM_PRICES_CENTS.annual) },
    signedIn: locals.caller.kind === "user",
  };
};
