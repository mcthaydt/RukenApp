import { error, json } from "@sveltejs/kit";
import { playedWords, staffOnly } from "../../../../../features/admin/admin.ts";
import { gamesServices } from "../../../../../features/games/games.ts";
import { playServices } from "../../../../../features/play/play.ts";
import type { RequestHandler } from "./$types";

// How long this staff member has played the waiting files, in the words the check page uses. The page asks again while
// they play, because the line drawn with the page is only as true as the moment it was drawn. It reads and changes
// nothing: a play is started by opening the check page, never by asking this.
export const GET: RequestHandler = async ({ locals, params }) => {
  const { userId } = staffOnly(locals.caller);
  const game = await gamesServices().service.gameForReview(params.game);
  if (game === null || game.pending === null) error(404, "Not found");
  const summary = await playServices().service.playSummary(game.id, { pullId: game.pending.id, userId });
  return json({ played: playedWords(summary.countedSeconds) }, { headers: { "cache-control": "no-store" } });
};
