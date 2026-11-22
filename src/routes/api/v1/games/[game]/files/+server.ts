import { api } from "../../../api.server.ts";
import { onGame } from "../../game-call.server.ts";
import type { RequestHandler } from "./$types";

// Deletes again the files a delete that stopped left behind, for a game that is off Ruken. Asked twice, nothing more happens.
export const DELETE: RequestHandler = api((event) =>
  onGame(event, async ({ service, game, userId }) => {
    await service.deleteLeftFiles(game.id, userId);
  }),
);
