import {
  CLIP_MAX_BYTES,
  gamesServices,
  ownGameOr404,
  type ClipShape,
} from "../../../../../../../features/games/games.ts";
import { bodyTooBig } from "../../../../../../../lib/server/body-size.ts";
import { api, countUpload, gameProblem, maker, problem } from "../../../../api.server.ts";
import { gameView } from "../../../game-view.server.ts";
import type { RequestHandler } from "./$types";

/** The file is the body, and nothing else with it: a video, as the browser's form sends it, but plain. */
const SHAPES: readonly string[] = ["upright", "wide"];

function isShape(word: string): word is ClipShape {
  return SHAPES.includes(word);
}

// A game's upright or wide video, sent as the raw file. It is saved by the same function as the browser's form (a live
// game's new video waits for review, and players keep the old one until then).
export const PUT: RequestHandler = api(async (event) => {
  const userId = await maker(event);
  const { service } = gamesServices();
  const { shape } = event.params;
  try {
    // Found first, so someone else's game, or a word that is no video, answers the same 404 whatever is sent.
    if (!isShape(shape)) return problem(404, "We can't find that game.");
    const game = await ownGameOr404(service, event.params.game, userId);

    // Refused before the body is read: a missing length is "send it again", a huge one is too big.
    if (event.request.headers.get("content-length") === null) return problem(411, "Send the video again.");
    if (bodyTooBig(event.request, CLIP_MAX_BYTES, true)) return problem(413, "A video can be up to 30 MB.");
    await countUpload(userId);

    const contentType = (event.request.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    const bytes = new Uint8Array(await event.request.arrayBuffer());
    await service.saveClip(game.id, shape, { contentType, bytes });
    return Response.json(gameView(await ownGameOr404(service, game.slug, userId)));
  } catch (error) {
    if (error instanceof Response) return error;
    return gameProblem(error);
  }
});
