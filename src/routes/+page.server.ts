import { feedServices } from "../features/feed/feed.ts";
import { launchServices } from "../features/launch/launch.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): its first page of clips in order, as whole addresses, and the address of the page after it. No
// game to show is an empty page, and the screen says so. Before launch each clip shows Wishlist where Play goes. A
// signed-in person whose feed learns from them gets More and Less like this on each clip; a browser that has not said
// yes to cookies is never signed in here, so it is never offered them.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const feed = feedServices();
  const userId = locals.caller.kind === "user" ? locals.caller.userId : null;
  const [first, launch, learning] = await Promise.all([
    feed.service.page(null, feed.askingOf(locals.caller), feed.viewerOf(locals.caller)),
    launchServices().screenFor(userId, cookies),
    userId === null ? Promise.resolve(null) : feed.taste.learningOf(userId),
  ]);
  return { first, launch, tune: learning === "on" };
};
