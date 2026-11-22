import { answersOf, firstUnanswered, GameError, liveSendOf } from "../../../../../../features/games/games.ts";
import { AGREE_FIRST, sendWhenAgreed } from "../../../../../../features/make/make.ts";
import { prisma } from "../../../../../../lib/server/db.ts";
import { api, problem } from "../../../api.server.ts";
import { onGame } from "../../game-call.server.ts";
import type { RequestHandler } from "./$types";

// Sends a game for review: a draft is asked for the maker agreement first, as Check and send is; a game staff sent back
// is sent again; a live game's fixed update is sent again as it is. Review itself stays staff's, so this never accepts.
export const POST: RequestHandler = api((event) =>
  onGame(event, async ({ service, game, userId }) => {
    try {
      if (game.state === "draft") await sendWhenAgreed(prisma(), service, game.id, userId);
      else if (game.state === "sent_back") await service.sendForReview(game.id, userId);
      else if (game.state === "live" && liveSendOf(game) === "again")
        await service.sendForReview(game.id, userId);
      else if (game.state === "live") {
        // Where the way on is a new version, say so: the command line points to it.
        const words = "That game can't be sent again right now.";
        return liveSendOf(game) === "new_version"
          ? Response.json({ problem: words, next: "update" }, { status: 400 })
          : problem(400, words);
      } else return problem(400, "That game can't be sent right now.");
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      // A refusal that has a next step says it: which question is open, or that the agreement is what is missing.
      const next = {
        ...(error.message === "Answer every question first."
          ? { question: firstUnanswered(answersOf(game)) }
          : {}),
        ...(error.message === AGREE_FIRST ? { agreement: true } : {}),
      };
      return Response.json(
        { problem: error.message, ...next },
        { status: error.code === "CONFLICT" ? 409 : 400 },
      );
    }
    return undefined;
  }),
);
