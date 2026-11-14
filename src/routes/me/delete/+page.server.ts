import { redirect } from "@sveltejs/kit";
import { authServices, requestDeletion, signedInOnly } from "../../../features/accounts/accounts.ts";
import { chicagoDayOf } from "../../../lib/clock.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Delete my account". Asking starts a 14-day wait (accounts/deletion.ts); signing in before it ends undoes it.
// A staff member sees why there is no button, because staff are removed by another staff member.
export const load: PageServerLoad = ({ locals, url }) => {
  signedInOnly(locals.caller, url);
  return { staff: locals.caller.kind === "user" && locals.caller.staffRoles.length > 0 };
};

export const actions: Actions = {
  default: async ({ locals, url, cookies }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const { prisma, clock, cookies: policy } = authServices();
    const answer = await requestDeletion({ prisma, clock }, userId);
    // Someone who got here without the button (a staff member posting by hand) lands back on the page that says why.
    if (answer === "staff") redirect(303, "/me/delete");
    // Every session is already gone from the database; the dead cookie goes too, so the browser keeps nothing.
    cookies.delete(policy.sessionCookieName, { path: "/" });
    redirect(303, `/goodbye?on=${chicagoDayOf(answer.purgeAfter.getTime())}`);
  },
};
