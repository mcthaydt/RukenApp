import { fail, redirect } from "@sveltejs/kit";
import { authServices, requestDeletion, signedInOnly } from "../../../features/accounts/accounts.ts";
import { membershipServices } from "../../../features/membership/membership.ts";
import { chicagoDayOf } from "../../../lib/clock.ts";
import type { Actions, PageServerLoad } from "./$types";

// "Delete my account". Asking starts a 14-day wait (accounts/deletion.ts); signing in before it ends undoes it.
// A staff member sees why there is no button, because staff are removed by another staff member.
export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const { state } = await membershipServices().service.view(userId);
  return {
    staff: locals.caller.kind === "user" && locals.caller.staffRoles.length > 0,
    // A membership that is still running, also one that is paused for a failed card, is charged until it is ended.
    paying: state === "active" || state === "canceling" || state === "past_due",
  };
};

export const actions: Actions = {
  default: async ({ locals, url, cookies }) => {
    const { userId } = signedInOnly(locals.caller, url);
    // Someone who got here without the button (a staff member posting by hand) lands back on the page that says why,
    // before anything is ended.
    if (locals.caller.kind === "user" && locals.caller.staffRoles.length > 0) redirect(303, "/me/delete");

    // A member is never charged while their account waits to be deleted: the membership ends now, with no refund. If
    // that fails nothing is deleted, so they never wait for a deletion that would still bill them.
    try {
      await membershipServices().service.endNow(userId);
    } catch (cause) {
      console.error(`membership not ended: ${cause instanceof Error ? cause.message : "unknown error"}`);
      return fail(500, { error: "Something went wrong on our side. Try again in a moment." });
    }

    const { prisma, clock, cookies: policy } = authServices();
    const answer = await requestDeletion({ prisma, clock }, userId);
    if (answer === "staff") redirect(303, "/me/delete");
    // Every session is already gone from the database; the dead cookie goes too, so the browser keeps nothing.
    cookies.delete(policy.sessionCookieName, { path: "/" });
    redirect(303, `/goodbye?on=${chicagoDayOf(answer.purgeAfter.getTime())}`);
  },
};
