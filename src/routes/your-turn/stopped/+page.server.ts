import { error, redirect } from "@sveltejs/kit";
import { sendsServices } from "../../../features/sends/sends.ts";
import type { Actions, PageServerLoad } from "./$types";

// The people this person stopped sending them games, each with Undo (games-sent-to-you brief, "Stop someone").
export const load: PageServerLoad = async ({ locals }) => {
  if (locals.caller.kind !== "user") redirect(303, `/sign-in?next=${encodeURIComponent("/your-turn/stopped")}`);
  return { people: await sendsServices().stoppedBy(locals.caller.userId) };
};

export const actions: Actions = {
  // Someone else's stop is a missing page, and nothing changes.
  undo: async ({ request, locals }) => {
    if (locals.caller.kind !== "user") error(401);
    const id = (await request.formData()).get("id");
    if (typeof id !== "string" || (await sendsServices().undo(locals.caller.userId, id)) === "not found") error(404);
    return { undone: true };
  },
};
