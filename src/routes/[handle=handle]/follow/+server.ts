import { error, redirect } from "@sveltejs/kit";
import { pagesServices } from "../../../features/pages/pages.ts";
import { safeNextPath } from "../../../lib/safe-next.ts";
import type { RequestHandler } from "./$types";

// Follow a maker (maker-credit-and-follow spec). The plus on a feed clip posts here: the person's answer, and the page
// to come back to. A page's own script asks for JSON and changes the badge in place; a plain form is sent back to its
// page.

/**
 * Set when a signed-out person presses the plus, naming the maker, and read on the way back from sign-up. Only a person
 * who pressed it carries it, so a link to the way back (from another page, even one on Ruken) follows nobody.
 */
const PRESSED_COOKIE = "rk_follow_pressed";
const PRESSED_FOR_SECONDS = 30 * 60;

/** The page to come back to: one of ours, else the feed. */
function backOf(raw: FormDataEntryValue | string | null): string {
  return typeof raw === "string" && raw !== "" ? safeNextPath(raw) : "/";
}

export const POST: RequestHandler = async ({ params, request, locals, cookies }) => {
  const form = await request.formData();
  const back = backOf(form.get("back"));
  const script = (request.headers.get("accept") ?? "").includes("application/json");
  const goTo = (address: string) => (script ? Response.json({ go: address }) : redirect(303, address));
  const follows = pagesServices().follows;

  // Signed out: the short sign-up, then straight back here (GET below), which follows the maker.
  if (locals.caller.kind !== "user") {
    if ((await pagesServices().service.pageByHandle(params.handle)) === null) error(404);
    cookies.set(PRESSED_COOKIE, params.handle, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: PRESSED_FOR_SECONDS,
    });
    const returnTo = `/${params.handle}/follow?back=${encodeURIComponent(back)}`;
    return goTo(`/sign-up?next=${encodeURIComponent(returnTo)}`);
  }

  const wants = form.get("want") === "off" ? "off" : "on";
  const done =
    wants === "on"
      ? await follows.follow(locals.caller.userId, params.handle)
      : await follows.unfollow(locals.caller.userId, params.handle);
  if (done === "no page") error(404);
  if (done === "own") error(400, "This is your page, so you can't follow it.");
  return script ? Response.json({ following: wants === "on" }) : redirect(303, back);
};

// The way back from sign-up: the person pressed the plus while signed out, so the maker is followed. Anything else that
// lands here (a link, a typed address) only goes on to the page: nobody pressed anything.
export const GET: RequestHandler = async ({ params, url, locals, cookies }) => {
  const back = backOf(url.searchParams.get("back"));
  if (locals.caller.kind === "user" && cookies.get(PRESSED_COOKIE) === params.handle) {
    cookies.delete(PRESSED_COOKIE, { path: "/" });
    // follow() checks the rest: a page at this address, and not the person's own (a maker who pressed their own plus
    // while signed out, then signed in, follows nobody).
    const done = await pagesServices().follows.follow(locals.caller.userId, params.handle);
    if (done === "no page") error(404);
  }
  redirect(303, back);
};
