import { feedServices } from "../../../../features/feed/feed.ts";
import type { RequestHandler } from "./$types";

// More like this or Less like this, from a clip's ••• sheet: `{ game, more }` as JSON, kept as a chip on Your feed. Only
// the feed's own script calls here: a page on another site cannot send JSON with the person's cookies without the
// browser asking this site first, and nothing here says yes to that.

const said = (words: string, status: number) => Response.json({ problem: words }, { status });

export const POST: RequestHandler = async ({ locals, request }) => {
  if (locals.caller.kind !== "user") return said("Sign in to tune your feed.", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const { game, more } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof game !== "string" || typeof more !== "boolean") return said("That didn't work. Try again.", 400);
  const outcome = await feedServices().taste.aboutGame(locals.caller.userId, game, more ? "more" : "less");
  if (outcome === "not-learning") return said("Your feed isn't learning right now.", 409);
  if (outcome === "own") return said("This is your game.", 403);
  if (outcome === "unknown") return said("That game isn't on Ruken now.", 404);
  return Response.json({ saved: true });
};
