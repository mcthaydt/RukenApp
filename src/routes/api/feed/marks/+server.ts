import { error } from "@sveltejs/kit";
import { adultsOnlyRefusal } from "../../../../features/accounts/accounts.ts";
import { feedServices, isMarkKind, pressPath, rememberPress } from "../../../../features/feed/feed.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import type { RequestHandler } from "./$types";

// Like, Save and Repost on a clip (learned-feed spec, unit G). The feed's buttons send `{ game, kind, on }` as JSON and
// get back what the button shows now. Only JSON is taken: a page on another site cannot send JSON here without the
// browser asking first, so nobody else's page can press these for a person. Without the cookie yes the consent gate
// refuses before this runs (consent/routes.ts), so nothing is kept.
export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) error(415);
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== "object" || body === null) error(400, "That is not a press.");
  const { game: slug, kind, on } = body as Record<string, unknown>;
  if (typeof slug !== "string" || !isMarkKind(kind) || typeof on !== "boolean")
    error(400, "That is not a press.");

  // Signed out: sign in, then the way back makes this press (pressed.ts). Taking a mark off needs nothing kept.
  if (locals.caller.kind !== "user") {
    const back = pressPath({ game: slug, kind });
    if (on) rememberPress(cookies, { game: slug, kind });
    const go = `/sign-in?next=${encodeURIComponent(on ? back : "/")}`;
    return Response.json({ go }, { status: 401, headers: { "cache-control": "no-store" } });
  }
  const game = await gamesServices().service.liveGameBySlug(slug);
  if (game === null) error(404);
  const refusal = await adultsOnlyRefusal(game.ageRating, locals.caller);
  if (refusal !== null) error(403, refusal);

  const done = await feedServices().marks.set(locals.caller.userId, game, kind, on);
  if (done === "own") error(403, "This is your game.");
  return Response.json(done, { headers: { "cache-control": "no-store" } });
};
