import { error } from "@sveltejs/kit";
import { firstGameStaff } from "../../../features/accounts/accounts.ts";
import {
  GameError,
  gamesServices,
  megabytes,
  ratingWords,
  readReviewOrder,
  SOMETHING_ELSE,
  websitesWords,
} from "../../../features/games/games.ts";
import { playServices } from "../../../features/play/play.ts";
import { prisma } from "../../../lib/server/db.ts";
import { hasJobSecret } from "../../../lib/server/job-secret.ts";
import type { RequestHandler } from "./$types";

// The Owner's review command: list what waits, look at a game before it is live, accept it, or send it back in the
// Owner's own words (design 5.5). Like `/jobs/first-owner`, it answers 404 to anyone without the secret, and it acts as
// the first staff account that may check games, so the command names no person. Slice 4's admin portal replaces it.

/** Every answer reads well in a terminal: two spaces of indent. */
function answer(body: object, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const problem = (words: string, status: number): Response => answer({ problem: words }, status);

async function bodyOf(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export const POST: RequestHandler = async ({ request }) => {
  if (!hasJobSecret(request)) error(404, "Not found");
  const order = readReviewOrder(await bodyOf(request));
  if ("problem" in order) return problem(order.problem, 400);

  const games = gamesServices();
  if (order.do === "list") {
    const waiting = await games.service.waitingGames();
    const says =
      waiting.length === 0
        ? "Nothing is waiting."
        : waiting.length === 1
          ? "1 game is waiting."
          : `${String(waiting.length)} games are waiting.`;
    return answer({
      says,
      waiting: waiting.map((one) => ({
        game: one.slug,
        name: one.name,
        kind: one.kind,
        since: one.sentAt.toISOString(),
      })),
    });
  }

  const game = await games.service.gameForReview(order.game);
  if (game === null) return problem("We can't find that game.", 404);
  if (game.pending === null) return problem("Nothing is waiting for review.", 409);
  const staffUserId = await firstGameStaff(prisma());
  if (staffUserId === null) return problem("Make the first staff account first.", 409);
  const kind = game.state === "live" ? "update" : "game";

  try {
    if (order.do === "look") {
      const play = playServices().service;
      const look = await play.reviewLook({
        game: { id: game.id, publicId: game.publicId },
        pull: { id: game.pending.id, connectHosts: game.pending.connectHosts },
        staffUserId,
      });
      const played = await play.playSummary(game.id);
      return answer({
        says: "Open the look link in a private window. It works for a day.",
        game: game.slug,
        name: game.name,
        kind,
        look,
        uprightVideo: game.clipKeys.upright === null ? null : games.media(game.clipKeys.upright),
        wideVideo: game.clipKeys.wide === null ? null : games.media(game.clipKeys.wide),
        oneLine: game.oneLine,
        rating: ratingWords(game.ageRating, game.contentMarks),
        websites: websitesWords(game.pending.connectHosts),
        files: `${String(game.pending.fileCount)} files, ${megabytes(game.pending.totalBytes)}`,
        playedSeconds: played.countedSeconds,
      });
    }
    if (order.do === "accept") {
      await games.service.accept(game.id, staffUserId);
      return answer({
        says: kind === "update" ? `${game.name}'s new version is live.` : `${game.name} is live.`,
      });
    }
    await games.service.sendBack(
      game.id,
      staffUserId,
      order.parts.map(({ part, words }) => ({ part, reason: SOMETHING_ELSE, note: words })),
    );
    return answer({ says: `${game.name} went back to its maker.` });
  } catch (failure) {
    if (failure instanceof GameError) return problem(failure.message, 400);
    throw failure;
  }
};
