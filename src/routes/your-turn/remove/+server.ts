import { error, redirect } from "@sveltejs/kit";
import { playtestServices } from "../../../features/playtest/playtest.ts";
import { sendsServices } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Remove, on a Your turn row: takes that game off the person's own list. The page's script asks for JSON and takes the
// row off in place; a plain form comes back to the list. Someone else's row is a missing page, and nothing changes. A
// playtest row (`kind=playtest`) leaves the list too, and the person stays a playtester.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (locals.caller.kind !== "user") error(401);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") error(404);
  const userId = locals.caller.userId;
  const done =
    form.get("kind") === "playtest"
      ? await playtestServices().service.hide(userId, id)
      : await sendsServices().remove(userId, id);
  if (done === "not found") error(404);
  const script = (request.headers.get("accept") ?? "").includes("application/json");
  return script ? Response.json({ removed: true }) : redirect(303, "/your-turn");
};
