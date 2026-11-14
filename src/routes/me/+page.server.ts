import { error, fail, redirect } from "@sveltejs/kit";
import { authServices, resendVerification, signedInOnly } from "../../features/accounts/accounts.ts";
import { membershipLine, membershipServices } from "../../features/membership/membership.ts";
import type { Actions, PageServerLoad } from "./$types";

// The signed-in person's own page. Signed out, `signedInOnly` sends them to sign in and back here.
async function accountOf(userId: string): Promise<{ email: string; emailVerified: boolean }> {
  const user = await authServices().prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true },
  });
  // The hook only lets an active account through, so a missing row means it was removed a moment ago.
  if (user === null) error(404);
  return user;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const account = await accountOf(userId);
  // The membership line and the one button under it, worked out by a pure function (membership/format.ts).
  const membership = membershipLine(await membershipServices().service.view(userId));
  return { ...account, membership };
};

export const actions: Actions = {
  // The address mailed is read from the database, never from the form: nobody can ask for a
  // confirmation link to be sent to someone else's address.
  resend: async (event) => {
    const { userId } = signedInOnly(event.locals.caller, event.url);
    const { email } = await accountOf(userId);
    return resendVerification(event, authServices().formDeps, email);
  },

  // "Manage or cancel", "Manage" and "Update card" all open Stripe's own billing page, where the member changes
  // their card or cancels: Ruken keeps no cancel screen of its own. It comes back to /me.
  portal: async ({ locals, url }) => {
    const { userId } = signedInOnly(locals.caller, url);
    let portalAt: string;
    try {
      portalAt = (await membershipServices().service.portalLink(userId)).url;
    } catch (cause) {
      console.error(`billing page did not open: ${cause instanceof Error ? cause.message : "unknown error"}`);
      return fail(500, { portalError: "Something went wrong on our side. Try again in a moment." });
    }
    // Stripe's page is another site, and the address is Stripe's answer to our own call.
    redirect(303, portalAt, { external: true });
  },
};
