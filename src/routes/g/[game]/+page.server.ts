import { error } from "@sveltejs/kit";
import { gamesServices, ratingWords } from "../../../features/games/games.ts";
import { membershipServices } from "../../../features/membership/membership.ts";
import { isPhone } from "../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// A game's own page: its clip, name, one line and rating, then Play. It stands in for the feed (slice 3), which will open
// at this game's clip. Only a live game has a page; any other address here is the missing page, so a game staff have not
// accepted, or one taken off Ruken, cannot be found by guessing its name.
export const load: PageServerLoad = async ({ params, cookies, url, request }) => {
  const games = gamesServices();
  const game = await games.service.liveGameBySlug(params.game);
  if (game === null) error(404);
  // Someone who lands here came by this maker's link: remembered, so a membership started now credits that maker
  // (design 6). Each new arrival replaces the last.
  membershipServices().arrival.remember(cookies, { makerUserId: game.makerUserId, path: url.pathname });
  return {
    slug: game.slug,
    name: game.name,
    oneLine: game.oneLine,
    rating: ratingWords(game.ageRating, game.contentMarks),
    clips: { upright: games.media(game.clips.upright), wide: games.media(game.clips.wide) },
    // A phone cannot play a game made for a computer, so the page says so instead of offering Play. The browser's own
    // words decide, as they do on the play page, so a tablet that calls itself a phone is told the same.
    needsComputer: game.playsOn === "computer_only" && isPhone(request.headers.get("user-agent")),
  };
};
