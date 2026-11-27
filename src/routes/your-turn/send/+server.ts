import { sendsServices, SEND_WORDS } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Sending a game to a friend, from the share sheet's faces (games-sent-to-you brief, "The site believes nothing the form
// sends"). Only the sheet's script posts here, as a form with the game's address and the friend's page address. A
// receiver who stopped the sender answers the same as a send that went, so the sender is never told.

const said = (problem: string, status: number) => Response.json({ problem }, { status });

export const POST: RequestHandler = async ({ request, locals }) => {
  if (locals.caller.kind !== "user") return said("Sign in to send a game.", 401);
  const form = await request.formData();
  const game = form.get("game");
  const to = form.get("to");
  if (typeof game !== "string" || typeof to !== "string" || game === "" || to === "")
    return said("Not found.", 404);
  const outcome = await sendsServices().send(locals.caller.userId, game, to);
  if (outcome === "no game" || outcome === "no person") return said("Not found.", 404);
  if (outcome === "self") return said("That's you.", 400);
  if (outcome === "not friends") return said("You can send games only to friends.", 403);
  if (typeof outcome === "object")
    return Response.json(
      { problem: SEND_WORDS.limited },
      { status: 429, headers: { "retry-after": String(outcome.limited) } },
    );
  return Response.json({ sent: true });
};
