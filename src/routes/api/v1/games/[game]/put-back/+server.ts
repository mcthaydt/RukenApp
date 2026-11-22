import { api } from "../../../api.server.ts";
import { onGame } from "../../game-call.server.ts";
import type { RequestHandler } from "./$types";

// A game its maker took off is copied again and sent for review like a new game; only a person's yes makes it live.
export const POST: RequestHandler = api((event) =>
  onGame(event, async ({ service, game, userId }) => {
    await service.putBack(game.id, userId);
  }),
);
