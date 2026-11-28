import { error } from "@sveltejs/kit";
import { adultsOnlyRefusal, signedInOnly } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { GAME_FRAME_ALLOW, GAME_FRAME_SANDBOX, playServices } from "../../../../features/play/play.ts";
import type { PageServerLoad } from "./$types";

// A maker's test play: their own game's files, before staff say yes (a draft, a game waiting for review, or a live game's
// new copy) or the live copy (before launch the game's own page shows Wishlist where Play goes, its maker's too). Only
// the game's own maker gets in. Anyone else, and a game with nothing to try, gets the missing page,
// the same as a game that is not there, so a stranger learns nothing. It is under the maker's area, never a game's own
// address, so nothing here reaches players, the feed or search.
export const load: PageServerLoad = async ({ locals, url, params }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const found = await gamesServices().service.testPlayOf(params.game, userId);
  if (found === null) error(404, "Not found");
  // The same line as a player's Play: an 18+ game's files are never opened for someone not known to be 18 or over.
  const refusal = await adultsOnlyRefusal(found.game.ageRating, locals.caller);
  if (refusal !== null) error(403, refusal);

  const frameUrl = await playServices().service.testPlay({
    game: found.game,
    pull: found.pull,
    makerUserId: userId,
  });
  return {
    name: found.game.name,
    slug: found.game.slug,
    frameUrl,
    frame: { sandbox: GAME_FRAME_SANDBOX, allow: GAME_FRAME_ALLOW },
  };
};
