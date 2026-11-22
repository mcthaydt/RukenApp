import { GameError, ownGameOr404 } from "../../../../../../features/games/games.ts";
import { api } from "../../../api.server.ts";
import { onGame } from "../../game-call.server.ts";
import type { RequestHandler } from "./$types";

// Takes a live game off Ruken. The maker can put it back; it then goes through review again.
export const POST: RequestHandler = api((event) =>
  onGame(event, async ({ service, game, userId }) => {
    try {
      await service.takeOff(game.id, userId);
    } catch (error) {
      if (error instanceof GameError) throw error;
      // Deleting the files stopped: the game is already off, and its screen says files are left and offers to delete them.
      if ((await ownGameOr404(service, game.slug, userId)).state !== "taken_off") throw error;
    }
  }),
);
