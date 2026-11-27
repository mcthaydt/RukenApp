import { error, fail, redirect } from "@sveltejs/kit";
import { feedServices } from "../../features/feed/feed.ts";
import { gamesServices } from "../../features/games/games.ts";
import { authServices, shownAs, signedInOnly } from "../../features/accounts/accounts.ts";
import { membershipLine, membershipServices } from "../../features/membership/membership.ts";
import type { Actions, PageServerLoad } from "./$types";

// The signed-in person's own page. Signed out, `signedInOnly` sends them to sign in and back here.
async function accountOf(userId: string): Promise<{ phone: string }> {
  const user = await authServices().prisma.user.findUnique({
    where: { id: userId },
    select: { phoneNumber: true },
  });
  // The hook only lets an active account through, so a missing row means it was removed a moment ago.
  if (user === null) error(404);
  return { phone: user.phoneNumber === null ? "" : shownAs(user.phoneNumber) };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const { userId } = signedInOnly(locals.caller, url);
  const account = await accountOf(userId);
  // The membership line and the one button under it, worked out by a pure function (membership/format.ts).
  const view = await membershipServices().service.view(userId);
  const membership = membershipLine(view);
  // The badge beside the number: a member right now (the one rule, `premiumAccess`), or not.
  const member = view.member;
  // Her door to the maker's area says what she can do there: open her games, or add the first.
  const makesGames = (await gamesServices().service.gamesOf(userId)).length > 0;
  // Saved and Your reposts are linked once they hold a live game.
  const feed = feedServices();
  const [saved, reposted] = await Promise.all([feed.listOf(userId, "save"), feed.listOf(userId, "repost")]);
  return {
    ...account,
    membership,
    member,
    makesGames,
    saved: saved.length > 0,
    reposted: reposted.length > 0,
  };
};

export const actions: Actions = {
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
