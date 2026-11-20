import { error } from "@sveltejs/kit";
import { GAME_STAFF_ROLES } from "../../../features/accounts/accounts.ts";
import { gamesServices, ratingLine, ratingWords, sittingWords } from "../../../features/games/games.ts";
import {
  dollars,
  membershipServices,
  PREMIUM_PRICES_CENTS,
} from "../../../features/membership/membership.ts";
import { pagesServices } from "../../../features/pages/pages.ts";
import { isPhone, playServices } from "../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// A live game's page (spec 3). A game that is not live is not here at all: the missing page.

/** What pressing Play costs this person, in the order spec 3.4 gives. */
type Cost = "own" | "staff" | "free" | "member" | "join";

export const load: PageServerLoad = async ({ params, locals, cookies, url, request }) => {
  const games = gamesServices();
  const game = await games.service.liveGameBySlug(params.game);
  if (game === null) error(404);

  // Landing here is an arrival through this maker's link (design 6): the last one a visitor made is who brought them.
  membershipServices().arrival.remember(cookies, { makerUserId: game.makerUserId, path: url.pathname });

  const caller = locals.caller;
  let cost: Cost = "join";
  if (caller.kind === "user" && caller.userId === game.makerUserId) cost = "own";
  else if (caller.kind === "user" && caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role)))
    cost = "staff";
  else if (game.freeToPlay) cost = "free";
  else if (caller.kind === "user" && (await membershipServices().service.isMember(caller.userId)))
    cost = "member";

  const makerPage = await pagesServices().service.pageOf(game.makerUserId);
  const sitting = await playServices().service.sittingOf(game.id, new Date());
  const more = makerPage === null ? [] : await games.service.moreLiveGamesBy(game.makerUserId, game.slug);

  return {
    name: game.name,
    slug: game.slug,
    oneLine: game.oneLine,
    rating: { chip: ratingWords(game.ageRating, game.contentMarks) ?? "", line: ratingLine(game.ageRating) },
    clips: { upright: games.media(game.clips.upright), wide: games.media(game.clips.wide) },
    // The server knows a phone from its User-Agent; the page's script says "tablet" where the pointer is coarse.
    device: isPhone(request.headers.get("user-agent")) ? ("phone" as const) : ("computer" as const),
    cost,
    price: dollars(PREMIUM_PRICES_CENTS.monthly),
    sitting: sitting === null ? null : sittingWords(sitting),
    maker:
      makerPage === null
        ? null
        : {
            name: makerPage.name,
            oneLine: makerPage.oneLine,
            photo: makerPage.photoKey === null ? null : games.media(makerPage.photoKey),
          },
    more: more.map((one) => ({ slug: one.slug, name: one.name, wideClip: games.media(one.wideClip) })),
  };
};
