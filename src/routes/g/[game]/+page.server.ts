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
import { launchServices } from "../../../features/launch/launch.ts";
import { pagesServices } from "../../../features/pages/pages.ts";
import { deviceOf, playServices } from "../../../features/play/play.ts";
import { sendsServices } from "../../../features/sends/sends.ts";
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
  const now = new Date();
  // The feed slides this page in only once its data has come (src/routes/+layout.svelte), so every wait here is a pause
  // after the tap before the slide (the owner, 2026-11-23, asked for the feed to slide to a game like every other move).
  // A request holds one database connection, so statements wait for each other however they are asked: what keeps the
  // page quick is that each question below is one statement (tests/features/*/ "asks the database once").
  const ownOrStaff =
    caller.kind === "user" &&
    (caller.userId === game.makerUserId || caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role)));
  const [member, makerPage, more, launch, sitting, players, friends] = await Promise.all([
    caller.kind === "user" && !ownOrStaff && !game.freeToPlay
      ? membershipServices().service.isMember(caller.userId)
      : false,
    pagesServices().service.cardOf(game.makerUserId),
    // The maker's other games, with their videos: an 18+ one only to someone known to be 18 or over. They show under the
    // maker's page only, but are asked for alongside it so the two waits are one.
    games.service.moreLiveGamesBy(game.makerUserId, game.slug).then(async (others) => {
      const adult = others.some((one) => one.ageRating === "age_18") && (await isKnownAdultCaller(caller));
      return others.filter((one) => adult || one.ageRating !== "age_18");
    }),
    // Before launch, Wishlist stands where Play goes (the play address itself stays open, on the owner's word).
    launchServices().screenFor(caller.kind === "user" ? caller.userId : null, cookies),
    playServices().service.sittingOf(game.id, now),
    // Asked only while the maker has turned the count on, so a game that has it off costs nothing and shows nothing.
    game.showsPlayerCount
      ? playServices().service.playersThisWeek(game.id, now).then(playersWords)
      : Promise.resolve(null),
    // The faces for "Send to a friend" in the share sheet: one statement, asked only for a signed-in person.
    caller.kind === "user" ? sendsServices().friendsOf(caller.userId) : Promise.resolve(null),
  ]);

  let cost: Cost = "join";
  if (caller.kind === "user" && caller.userId === game.makerUserId) cost = "own";
  else if (caller.kind === "user" && caller.staffRoles.some((role) => GAME_STAFF_ROLES.includes(role)))
    cost = "staff";
  else if (game.freeToPlay) cost = "free";
  else if (member) cost = "member";

  return {
    name: game.name,
    slug: game.slug,
    oneLine: game.oneLine,
    friends,
    rating: { chip: ratingWords(game.ageRating, game.contentMarks) ?? "", line: ratingLine(game.ageRating) },
    clips: { upright: games.media(game.clips.upright), wide: games.media(game.clips.wide) },
    // The server knows a phone from its User-Agent; the page's script says "tablet" where the pointer is coarse.
    device: deviceOf(request.headers.get("user-agent")),
    cost,
    launch,
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
            // An unlisted maker's address is the missing page, so "Made by" names them in words, with no link.
            listed: makerPage.listed,
          },
    more: (makerPage === null ? [] : more).map((one) => ({
      slug: one.slug,
      name: one.name,
      wideClip: games.media(one.wideClip),
    })),
  };
};
