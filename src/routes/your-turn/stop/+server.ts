import { error, redirect } from "@sveltejs/kit";
import { sendsServices } from "../../../features/sends/sends.ts";
import type { RequestHandler } from "./$types";

// Stop, on a Your turn row: the person who sent it sends this person nothing more, and every game they sent goes. They
// are never told. Someone else's row is a missing page, and nothing changes.
export const POST: RequestHandler = async ({ request, locals }) => {
  if (locals.caller.kind !== "user") error(401);
  const id = (await request.formData()).get("id");
  if (typeof id !== "string" || (await sendsServices().stop(locals.caller.userId, id)) === "not found") error(404);
  const script = (request.headers.get("accept") ?? "").includes("application/json");
  return script ? Response.json({ stopped: true }) : redirect(303, "/your-turn");
};
