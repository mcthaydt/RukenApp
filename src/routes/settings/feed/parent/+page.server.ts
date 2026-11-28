import { fail, redirect } from "@sveltejs/kit";
import { OPEN_COUNTRIES, signedInOnly } from "../../../../features/accounts/accounts.ts";
import { feedServices } from "../../../../features/feed/feed.ts";
import type { Actions, PageServerLoad } from "./$types";

// Ask a parent (learned feed spec 6.5): a teen whose feed does not learn types their first name and a parent's number,
// and Ruken texts the parent a link with Yes and No. Anyone whose feed already learns, or who is waiting, goes back to
// Your feed, which says where things stand.

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const feed = feedServices();
  if (
    (await feed.taste.learningOf(userId)) !== "locked" ||
    (await feed.parentAsks.stateOf(userId)) !== "none"
  )
    redirect(303, "/settings/feed");
  return { countries: OPEN_COUNTRIES };
};

const PROBLEMS = {
  "bad-name": "Type your first name, using letters only.",
  "bad-number": "That phone number doesn't look right. Check it and try again.",
  "own-number": "Type your parent's number, not yours.",
  "teen-number": "That number is a teen's. Type your parent's number.",
  "said-no": "That parent already said no.",
  "number-busy": "That number has had enough texts today. Try again tomorrow.",
  "too-many": "You've asked three times today. Try again tomorrow.",
  "not-sent": "We couldn't text that number. Check it and try again.",
} as const;

const words = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export const actions: Actions = {
  default: async ({ locals, url, request }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const form = await request.formData();
    const typed = { name: words(form, "name"), country: words(form, "country"), phone: words(form, "phone") };
    const outcome = await feedServices().parentAsks.ask(userId, typed, url.origin);
    // Texted, or nothing to ask for (already waiting, a yes holds, or 18 now): Your feed says which.
    if (outcome === "texted" || outcome === "waiting" || outcome === "has-yes" || outcome === "adult")
      redirect(303, "/settings/feed");
    return fail(400, { ...typed, problem: PROBLEMS[outcome] });
  },
};
