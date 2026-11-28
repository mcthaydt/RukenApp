import { error } from "@sveltejs/kit";
import { hasConsent } from "../../features/consent/consent.ts";
import { gamesServices } from "../../features/games/games.ts";
import { launchServices } from "../../features/launch/launch.ts";
import { membershipServices } from "../../features/membership/membership.ts";
import { pagesServices } from "../../features/pages/pages.ts";
import type { PageServerLoad } from "./$types";

// A maker's page (spec 5.4). An address nobody has is the missing page, and so is an unlisted page's (the page sign-up
// made from a name, for everyone, its maker too), before a view is counted or an arrival remembered.

export const load: PageServerLoad = async ({ params, locals, cookies, url }) => {
  const pages = pagesServices().service;
  const page = await pages.pageByHandle(params.handle);
  if (page === null || !page.listed) error(404);

  const viewer = locals.caller.kind === "user" ? locals.caller.userId : null;
  // The maker opening their own page is not a visitor: `countView` leaves them out.
  // Counted only for a browser that said yes to cookies; without it nothing is written about the visit.
  if (hasConsent(cookies)) await pages.countView(page.id, viewer);
  // Landing here is an arrival through this maker's page (design 6): the last one a visitor made is who brought them.
  membershipServices().arrival.remember(cookies, { makerUserId: page.makerUserId, path: url.pathname });

  const games = gamesServices();
  const listed = await games.service.liveGames({ makerUserId: page.makerUserId });
  // Until the 18+ rules are built, a clip that plays by itself in front of anyone must not be an 18+ game's. The game
  // keeps its own page at /g/<game>.
  const shown = listed
    .filter((game) => game.ageRating !== "age_18")
    .sort((a, b) => b.liveSince.getTime() - a.liveSince.getTime());

  return {
    name: page.name,
    handle: page.handle,
    oneLine: page.oneLine,
    photo: page.photoKey === null ? null : games.media(page.photoKey),
    colours: {
      ground: page.theme.ground,
      text: page.theme.text,
      button: page.theme.button,
      buttonText: page.theme.buttonText,
      all: page.theme.colours,
    },
    games: shown.map((game) => ({
      slug: game.slug,
      name: game.name,
      upright: games.media(game.clips.upright),
    })),
    links: page.links,
    // Before launch each game shows Wishlist where Play goes.
    launch: await launchServices().screenFor(viewer, cookies),
  };
};
