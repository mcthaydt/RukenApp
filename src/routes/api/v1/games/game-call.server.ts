import type { RequestEvent } from "@sveltejs/kit";
import { gamesServices, ownGameOr404, type MakerGame } from "../../../../features/games/games.ts";
import { gameProblem, maker } from "../api.server.ts";
import { gameView } from "./game-view.server.ts";

/** What a call on one game is given: the games service, the game as its maker sees it, and the maker. */
export interface GameCall {
  service: ReturnType<typeof gamesServices>["service"];
  game: MakerGame;
  userId: string;
}

/**
 * The shape every endpoint on one game shares: the key's maker, their game (someone else's is a 404 that says nothing),
 * the call, then the game read back as the command line shows it. `run` may answer on its own (a refusal with more to
 * say), or give the game's address when a change moved it (a new name can).
 */
export async function onGame(
  event: Pick<RequestEvent, "locals"> & { params: { game: string } },
  run: (call: GameCall) => Promise<unknown>,
): Promise<Response> {
  const userId = await maker(event);
  const { service } = gamesServices();
  try {
    const game = await ownGameOr404(service, event.params.game, userId);
    const done = await run({ service, game, userId });
    if (done instanceof Response) return done;
    const moved = (done as { slug?: unknown } | null | undefined)?.slug;
    return Response.json(
      gameView(await ownGameOr404(service, typeof moved === "string" ? moved : game.slug, userId)),
    );
  } catch (error) {
    return gameProblem(error);
  }
}
