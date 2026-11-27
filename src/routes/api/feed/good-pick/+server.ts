import { feedServices } from "../../../../features/feed/feed.ts";
import type { RequestHandler } from "./$types";

// The answer to a Good pick card: `{ game, yes }` as JSON. Only a question the feed asked this person can be answered,
// once. Called only by the feed's own script, as JSON, for the same reason as More and Less like this.

const said = (words: string, status: number) => Response.json({ problem: words }, { status });

export const POST: RequestHandler = async ({ locals, request }) => {
  if (locals.caller.kind !== "user") return said("Sign in to tune your feed.", 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const { game, yes } = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (typeof game !== "string" || typeof yes !== "boolean") return said("That didn't work. Try again.", 400);
  const outcome = await feedServices().taste.answer(locals.caller.userId, game, yes);
  if (outcome === "not-learning") return said("Your feed isn't learning right now.", 409);
  if (outcome === "not-asked") return said("That question has been answered.", 409);
  return Response.json({ saved: true });
};
