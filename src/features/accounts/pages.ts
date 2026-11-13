import { redirect } from "@sveltejs/kit";
import { safeNextPath } from "../../lib/safe-next.ts";
import type { Caller } from "./caller.ts";

/**
 * The `load` for /sign-in and /sign-up: the page gets `next` only after safeNextPath has checked
 * it, and someone who is already signed in goes straight on to it.
 */
export function signedInRedirect(caller: Caller, url: URL): { next: string } {
  const next = safeNextPath(url.searchParams.get("next"));
  if (caller.kind === "user") redirect(303, next);
  return { next };
}

/**
 * The `load` for pages only a signed-in person sees: anyone else goes to sign in and comes back
 * here. Returns the user and the checked `next`.
 */
export function signedInOnly(caller: Caller, url: URL): { userId: string; next: string } {
  if (caller.kind !== "user") redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
  return { userId: caller.userId, next: safeNextPath(url.searchParams.get("next")) };
}
