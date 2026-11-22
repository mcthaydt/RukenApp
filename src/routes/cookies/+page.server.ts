import { fail, isRedirect, redirect } from "@sveltejs/kit";
import { authServices, signOut } from "../../features/accounts/accounts.ts";
import { agree, consentDay, hasConsent, takeBack, type GatedAction } from "../../features/consent/consent.ts";
import { gamesServices } from "../../features/games/games.ts";
import { membershipServices } from "../../features/membership/membership.ts";
import { isHandleShape, pagesServices } from "../../features/pages/pages.ts";
import { chicagoDayOf, systemClock } from "../../lib/clock.ts";
import { longDay } from "../../lib/long-date.ts";
import { safeNextPath } from "../../lib/safe-next.ts";
import type { Actions, PageServerLoad } from "./$types";

// The notice, and the place to take the yes back. A browser with no yes sees the notice (and what was pressed, when a
// gated screen sent it here); a browser with a yes sees when it said so and "Take it back".

const FOR = [
  "sign-in",
  "sign-up",
  "join",
  "play",
  "save",
  "account",
] as const satisfies readonly GatedAction[];

export const load: PageServerLoad = ({ cookies, url }) => {
  const asked = url.searchParams.get("for");
  const day = consentDay(cookies);
  return {
    next: safeNextPath(url.searchParams.get("next")),
    reason: FOR.find((one) => one === asked) ?? null,
    // A yes from before the day was written into the cookie still says yes, with no date.
    day: day === null ? null : longDay(day),
    consented: hasConsent(cookies),
  };
};

/**
 * Landing on a game's page or a maker's page is an arrival through that maker (design 6). Someone who answers the
 * notice from Join, Play or Sign in on such a page must not lose it, so the answer remembers it, now that it may.
 */
async function rememberArrival(
  cookies: Parameters<typeof agree>[0] & Parameters<typeof hasConsent>[0],
  from: string,
) {
  const path = safeNextPath(from).split("?")[0] ?? "/";
  const [first, second, ...rest] = path.split("/").filter(Boolean);
  const arrival = membershipServices().arrival;
  if (first === "g" && second !== undefined) {
    const game = await gamesServices().service.liveGameBySlug(second);
    if (game !== null) arrival.remember(cookies, { makerUserId: game.makerUserId, path: `/g/${second}` });
  } else if (first !== undefined && second === undefined && rest.length === 0 && isHandleShape(first)) {
    const page = await pagesServices().service.pageByHandle(first);
    if (page !== null) arrival.remember(cookies, { makerUserId: page.makerUserId, path: `/${first}` });
  }
}

export const actions: Actions = {
  agree: async ({ cookies, request, url }) => {
    const data = await request.formData();
    const text = (key: string): string => {
      const value = data.get(key);
      return typeof value === "string" ? value : "";
    };
    agree(cookies, url.protocol === "https:", chicagoDayOf(systemClock.epochMs()));
    await rememberArrival(cookies, text("from"));
    redirect(303, safeNextPath(text("next")));
  },

  // Signs this browser out here (the session row too, as Sign out does), then deletes every Ruken cookie. The account
  // stays. Only with a yes: without one there is nothing to take back.
  takeBack: async (event) => {
    if (!hasConsent(event.cookies)) return fail(400, { done: false });
    try {
      await signOut(event, authServices().formDeps);
    } catch (thrown) {
      // Signing out ends in a redirect, which is only how it says it is done.
      if (!isRedirect(thrown)) throw thrown;
    }
    takeBack(event.cookies);
    return { done: true };
  },
};
