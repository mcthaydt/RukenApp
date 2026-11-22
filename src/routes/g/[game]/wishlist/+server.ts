import { error, redirect } from "@sveltejs/kit";
import { adultsOnlyRefusal } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { launchServices } from "../../../../features/launch/launch.ts";
import { safeNextPath } from "../../../../lib/safe-next.ts";
import type { RequestHandler } from "./$types";

// Wishlist, before launch (wishlist spec). The button posts here: the person's answer, and the page to come back to.
// A page's own script asks for JSON and changes the button in place; a plain form is sent back to its page. From launch
// there is no wishlist, so nothing is changed and the page is drawn again, now with Play.

/** The page to come back to: one of ours, else the game's own page. */
function backOf(raw: FormDataEntryValue | string | null, slug: string): string {
  return typeof raw === "string" && raw !== "" ? safeNextPath(raw) : `/g/${slug}`;
}

/** A live game this caller may see, or the same refusal its page gives. */
async function gameFor(slug: string, caller: App.Locals["caller"]) {
  const game = await gamesServices().service.liveGameBySlug(slug);
  if (game === null) error(404);
  const refusal = await adultsOnlyRefusal(game.ageRating, caller);
  if (refusal !== null) error(403, refusal);
  return game;
}

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
  const game = await gameFor(params.game, locals.caller);
  const form = await request.formData();
  const back = backOf(form.get("back"), game.slug);
  const script = (request.headers.get("accept") ?? "").includes("application/json");
  const goTo = (address: string) => (script ? Response.json({ go: address }) : redirect(303, address));

  // Signed out: the short sign-up, then straight back here (GET below), which puts the game on the new list.
  if (locals.caller.kind !== "user") {
    const returnTo = `/g/${game.slug}/wishlist?back=${encodeURIComponent(back)}`;
    return goTo(`/sign-up?next=${encodeURIComponent(returnTo)}`);
  }

  const launch = launchServices();
  const now = launch.now(cookies);
  const wants = form.get("want") === "off" ? "off" : "on";
  const done =
    wants === "on"
      ? await launch.wishlist.add(locals.caller.userId, game.id, now)
      : await launch.wishlist.remove(locals.caller.userId, game.id, now);
  if (done === "open") return goTo(back);
  return script ? Response.json({ wished: wants === "on" }) : redirect(303, back);
};

// The way back from sign-up: the person pressed Wishlist while signed out, so the game goes on their list. A link from
// another site lands here too; only a request the browser says came from Ruken itself adds anything, so another site
// cannot put games on a person's list.
export const GET: RequestHandler = async ({ params, url, request, locals, cookies }) => {
  const game = await gameFor(params.game, locals.caller);
  const back = backOf(url.searchParams.get("back"), game.slug);
  const fromRuken = request.headers.get("sec-fetch-site") !== "cross-site";
  if (locals.caller.kind === "user" && fromRuken) {
    const launch = launchServices();
    await launch.wishlist.add(locals.caller.userId, game.id, launch.now(cookies));
  }
  redirect(303, back);
};
