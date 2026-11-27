import { error, redirect } from "@sveltejs/kit";
import { sendsServices } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Remove, on a Your turn row: takes that game off the person's own list. The page's script asks for JSON and takes the
// row off in place; a plain form comes back to the list. Someone else's row is a missing page, and nothing changes.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (locals.caller.kind !== "user") error(401);
  const id = (await request.formData()).get("id");
  if (typeof id !== "string" || (await sendsServices().remove(locals.caller.userId, id)) === "not found") error(404);
  const script = (request.headers.get("accept") ?? "").includes("application/json");
  return script ? Response.json({ removed: true }) : redirect(303, "/your-turn");
};
