import { error, redirect } from "@sveltejs/kit";
import { adultsOnlyRefusal, isKnownAdultCaller } from "../../../../features/accounts/accounts.ts";
import { gamesServices } from "../../../../features/games/games.ts";
import { launchServices } from "../../../../features/launch/launch.ts";
import { playtestServices } from "../../../../features/playtest/playtest.ts";
import { safeNextPath } from "../../../../lib/safe-next.ts";
import type { RequestHandler } from "./$types";

// Ask to playtest, and take the ask back (playtesting spec), as Wishlist does it: the game's page posts here, a page's
// own script asks for JSON and changes the tile in place, and a plain form is sent back to its page.

/**
 * Set when a signed-out person presses Ask, naming the game, and read on the way back from sign-up. Only a person who
 * pressed it carries it, so a bare link to the way back asks nothing.
 */
const PRESSED_COOKIE = "rk_playtest_pressed";
const PRESSED_FOR_SECONDS = 30 * 60;

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

  const caller = locals.caller;
  if (caller.kind !== "user") {
    cookies.set(PRESSED_COOKIE, game.slug, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: PRESSED_FOR_SECONDS,
    });
    const returnTo = `/g/${game.slug}/playtest?back=${encodeURIComponent(back)}`;
    return goTo(`/sign-up?next=${encodeURIComponent(returnTo)}`);
  }

  const service = playtestServices().service;
  const now = launchServices().now(cookies);
  // The maker has no ask to make or take back on their own game: nothing here is theirs.
  if (caller.userId === game.makerUserId) error(404);
  if (form.get("want") === "off") await service.takeBack(caller.userId, game.slug, now);
  else await service.ask(caller.userId, game.slug, now, () => isKnownAdultCaller(caller));
  // Whatever happened (a refusal too, say the switch went off meanwhile), the tile shows what is true now.
  const look = await service.viewOf(game.slug, caller.userId, now);
  return script ? Response.json({ look }) : redirect(303, back);
};

// The way back from sign-up: the person pressed Ask while signed out, so the ask is sent. Anything else that lands here
// only goes on to the page: nobody pressed anything.
export const GET: RequestHandler = async ({ params, url, locals, cookies }) => {
  const game = await gameFor(params.game, locals.caller);
  const back = backOf(url.searchParams.get("back"), game.slug);
  const caller = locals.caller;
  if (caller.kind === "user" && cookies.get(PRESSED_COOKIE) === game.slug) {
    cookies.delete(PRESSED_COOKIE, { path: "/" });
    await playtestServices().service.ask(caller.userId, game.slug, launchServices().now(cookies), () =>
      isKnownAdultCaller(caller),
    );
  }
  redirect(303, back);
};
