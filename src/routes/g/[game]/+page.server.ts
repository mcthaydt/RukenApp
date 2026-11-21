import { error } from "@sveltejs/kit";
import {
  adultsOnlyRefusal,
  GAME_STAFF_ROLES,
  isKnownAdultCaller,
} from "../../../features/accounts/accounts.ts";
import {
  gamesServices,
  ratingLine,
  playersWords,
  ratingWords,
  sittingWords,
} from "../../../features/games/games.ts";
import {
  dollars,
  membershipServices,
  PREMIUM_PRICES_CENTS,
} from "../../../features/membership/membership.ts";
import { pagesServices } from "../../../features/pages/pages.ts";
import { deviceOf, playServices } from "../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// A live game's page (spec 3). A game that is not live is not here at all: the missing page.

/** What pressing Play costs this person, in the order spec 3.4 gives. */
type Cost = "own" | "staff" | "free" | "member" | "join";

export const load: PageServerLoad = async ({ params, locals, cookies, url, request }) => {
  const games = gamesServices();
  const game = await games.service.liveGameBySlug(params.game);
  if (game === null) error(404);
  // An 18+ game is for people known to be 18 or over: anyone else learns nothing about it, not even that it is here.
  const refusal = await adultsOnlyRefusal(game.ageRating, locals.caller);
  if (refusal !== null) error(403, refusal);

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
  // Asked only while the maker has turned the count on, so a game that has it off costs nothing and shows nothing.
  const players = game.showsPlayerCount
    ? playersWords(await playServices().service.playersThisWeek(game.id, new Date()))
    : null;
  const others = makerPage === null ? [] : await games.service.moreLiveGamesBy(game.makerUserId, game.slug);
  // The maker's other games show their videos: an 18+ one only to someone known to be 18 or over.
  const adult = others.some((one) => one.ageRating === "age_18") && (await isKnownAdultCaller(caller));
  const more = others.filter((one) => adult || one.ageRating !== "age_18");

  return {
    name: game.name,
    slug: game.slug,
    oneLine: game.oneLine,
    rating: { chip: ratingWords(game.ageRating, game.contentMarks) ?? "", line: ratingLine(game.ageRating) },
    clips: { upright: games.media(game.clips.upright), wide: games.media(game.clips.wide) },
    // The server knows a phone from its User-Agent; the page's script says "tablet" where the pointer is coarse.
    device: deviceOf(request.headers.get("user-agent")),
    cost,
    price: dollars(PREMIUM_PRICES_CENTS.monthly),
    sitting: sitting === null ? null : sittingWords(sitting),
    players,
    maker:
      makerPage === null
        ? null
        : {
            handle: makerPage.handle,
            name: makerPage.name,
            oneLine: makerPage.oneLine,
            photo: makerPage.photoKey === null ? null : games.media(makerPage.photoKey),
          },
    more: more.map((one) => ({ slug: one.slug, name: one.name, wideClip: games.media(one.wideClip) })),
  };
};
