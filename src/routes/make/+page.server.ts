import { redirect } from "@sveltejs/kit";
import { signedInOnly } from "../../features/accounts/accounts.ts";
import { acceptanceWords, GameError, gamesServices } from "../../features/games/games.ts";
import type { Actions, PageServerLoad } from "./$types";

// The maker's area: their games, each with where it stands in words. Signed out, what putting a game on Ruken gives a
// maker, with Join and Sign in that come back here (the owner, 2026-11-28: the plus in the bar "does nothing when you're
// signed out"). A connection to GitHub that could not be finished and has no question to go back to (a state that did
// not open) says so here.

/** The one-time note that a game was thrown away: set by the action, read and cleared by the next look at Your games. */
const THROWN_AWAY = "thrown-away";

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
  if (locals.caller.kind !== "user") return { signedOut: true as const };
  const { userId } = locals.caller;
  const games = gamesServices();
  // Said once: the note is gone the moment it is read, so a reload shows the plain list.
  const thrown = cookies.get(THROWN_AWAY) ?? null;
  if (thrown !== null) cookies.delete(THROWN_AWAY, { path: "/make" });
  return {
    signedOut: false as const,
    // Each game's picture is its wide video's first frame, or nothing until it has one.
    games: (await games.service.gamesOf(userId)).map((game) => ({
      ...game,
      still: game.wideClipKey === null ? null : games.media(game.wideClipKey),
    })),
    // Measured from staff's decisions on every look, never typed.
    acceptance: acceptanceWords(await games.service.acceptance()),
    githubFailed: url.searchParams.get("github") === "failed",
    thrown,
  };
};

export const actions: Actions = {
  // Throws a game away, then shows Your games with the note. A post for a game that is not there (a reload, someone
  // else's, one already thrown away) or one that may not be thrown away (waiting, live) changes nothing and shows the list.
  throwAway: async ({ locals, request, url, cookies }) => {
    const { userId } = signedInOnly(locals.caller, url);
    const slug = (await request.formData()).get("game");
    const { service } = gamesServices();
    const game = typeof slug === "string" ? await service.gameForMaker(slug, userId) : null;
    if (game !== null) {
      try {
        const { name } = await service.throwAway(game.id, userId);
        cookies.set(THROWN_AWAY, name, { path: "/make", httpOnly: true, sameSite: "lax", maxAge: 60 });
      } catch (problem) {
        if (!(problem instanceof GameError)) throw problem;
      }
    }
    redirect(303, "/make");
  },
};
