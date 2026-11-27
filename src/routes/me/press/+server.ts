import { redirect } from "@sveltejs/kit";
import { adultsOnlyRefusal, signedInOnly } from "../../../features/accounts/accounts.ts";
import { feedServices, pressOfPath, takePress } from "../../../features/feed/feed.ts";
import { gamesServices } from "../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// The way back for a press of Like, Save or Repost that waited for sign-in (pressed.ts). Under /me, so a person signed
// out signs in first and comes back here. The press is
// made only when the person made it (its note matches), then they go back to the feed at that game's clip.
export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const press = pressOfPath(url.pathname + url.search);
  if (press === null) redirect(303, "/");
  const { userId } = signedInOnly(locals.caller, url);
  if (takePress(cookies, press)) {
    const game = await gamesServices().service.liveGameBySlug(press.game);
    if (game !== null && (await adultsOnlyRefusal(game.ageRating, locals.caller)) === null) {
      await feedServices().marks.set(userId, game, press.kind, true);
    }
  }
  redirect(303, `/?at=${encodeURIComponent(press.game)}`);
};
