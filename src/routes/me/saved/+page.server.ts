import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { feedServices } from "../../../features/feed/feed.ts";
import type { Actions, PageServerLoad } from "./$types";

// Saved: the live games the person pressed Save on, each with a way to take it off.

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return { games: await feedServices().listOf(userId, "save") };
};

export const actions: Actions = {
  remove: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const slug = (await request.formData()).get("game");
    if (typeof slug === "string") await feedServices().marks.takeOff(userId, slug, "save");
    return { removed: true };
  },
};
