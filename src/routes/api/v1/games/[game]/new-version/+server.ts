import { GameError } from "../../../../../../features/games/games.ts";
import { api, problem } from "../../../api.server.ts";
import { onGame } from "../../game-call.server.ts";
import type { RequestHandler } from "./$types";

// A live game's newest files are copied and sent for review in one go; its old files stay live meanwhile.
export const POST: RequestHandler = api((event) =>
  onGame(event, async ({ service, game, userId }) => {
    if (game.state !== "live") return problem(400, "That game can't be sent right now.");
    try {
      await service.pullLatest(game.id);
      await service.sendForReview(game.id, userId);
    } catch (error) {
      // Ruken can't see the repository: on Live the way to mend that is the Change beside the game's files.
      if (error instanceof GameError && error.code === "NOT_CONNECTED" && game.repoFullName !== null) {
        return problem(
          400,
          `Ruken can't see your game on GitHub any more. Press Change next to ${game.repoFullName} to add it again.`,
        );
      }
      throw error;
    }
    return undefined;
  }),
);
