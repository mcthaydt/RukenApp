import { redirect } from "@sveltejs/kit";
import { isKnownAdultCaller } from "../../../features/accounts/accounts.ts";
import { launchServices } from "../../../features/launch/launch.ts";
import { playtestServices } from "../../../features/playtest/playtest.ts";
import type { RequestHandler } from "./$types";

// A maker's invite link (playtesting spec): whoever opens it signed in becomes a playtester of that game and lands on
// its page, showing Play with the tag. Signed out, they sign in first and come straight back here. The service decides
// what the link may change (never a no or a removal, and nothing from launch on); this only sends the person on.
export const GET: RequestHandler = async ({ params, locals, cookies, url }) => {
  const caller = locals.caller;
  if (caller.kind !== "user") redirect(303, `/sign-in?next=${encodeURIComponent(url.pathname)}`);
  const slug = await playtestServices().service.openLink(
    caller.userId,
    params.token,
    launchServices().now(cookies),
    () => isKnownAdultCaller(caller),
  );
  // Only a token that was never a link matches no game; a replaced link still names its game.
  redirect(303, slug === null ? "/" : `/g/${slug}`);
};
