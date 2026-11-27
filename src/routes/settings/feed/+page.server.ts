import { fail } from "@sveltejs/kit";
import { signedInOnly } from "../../../features/accounts/accounts.ts";
import { feedServices } from "../../../features/feed/feed.ts";
import type { Actions, PageServerLoad } from "./$types";

// Settings › Your feed (learned feed spec 6.2; the Owner, 2026-11-27: feed settings live under Settings): what the feed
// learned or was told, more and less of, as chips; Learn from what I do; and Start over. Signed out, sign in first.

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  return { feed: await feedServices().taste.view(userId) };
};

const words = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

const NOT_LEARNING = "Your feed isn't learning right now, so nothing was added.";

export const actions: Actions = {
  add: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const form = await request.formData();
    const direction = words(form, "direction");
    const kind = words(form, "kind");
    if (
      (direction !== "more" && direction !== "less") ||
      (kind !== "mood" && kind !== "genre" && kind !== "maker")
    )
      return fail(400, { problem: "That couldn't be added. Try again." });
    const outcome = await feedServices().taste.add(userId, direction, kind, words(form, "value"));
    if (outcome === "not-learning") return fail(409, { problem: NOT_LEARNING });
    if (outcome !== "added") return fail(400, { problem: "That couldn't be added. Try again." });
    return { done: "added" as const };
  },

  remove: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    await feedServices().taste.remove(userId, words(await request.formData(), "id"));
    return { done: "removed" as const };
  },

  startOver: async ({ locals, url }) => {
    const { userId } = signedInOnly(locals.caller, url);
    await feedServices().taste.startOver(userId);
    return { done: "started-over" as const };
  },

  learning: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    // The form sends the state it wants, so a second press never undoes the first.
    const on = words(await request.formData(), "learn") === "on";
    if ((await feedServices().taste.setLearning(userId, on)) === "locked")
      return fail(403, { problem: "Your feed doesn't learn from what you do until a parent says yes." });
    return { done: on ? ("on" as const) : ("off" as const) };
  },
};
