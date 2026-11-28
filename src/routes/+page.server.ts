import { feedServices, TAB_DATA } from "../features/feed/feed.ts";
import { isKnownAdultCaller } from "../features/accounts/accounts.ts";
import { launchServices } from "../features/launch/launch.ts";
import { sendsServices } from "../features/sends/sends.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): its first page of clips in order, as whole addresses, and the address of the page after it. No
// game to show is an empty page, and the screen says so. Before launch each clip shows Wishlist where Play goes. A
// signed-in person whose feed learns from them gets More and Less like this on each clip; a browser that has not said
// yes to cookies is never signed in here, so it is never offered them.
export const load: PageServerLoad = async ({ locals, cookies, depends }) => {
  // A tab shown from a page asked for ahead asks again quietly once it is in (src/features/feed/kept.svelte.ts).
  depends(TAB_DATA);
  const feed = feedServices();
  const userId = locals.caller.kind === "user" ? locals.caller.userId : null;
  const caller = locals.caller;
  const [first, launch, learning, news, friends] = await Promise.all([
    feed.service.page(null, feed.askingOf(caller), feed.viewerOf(caller)),
    launchServices().screenFor(userId, cookies),
    userId === null ? Promise.resolve(null) : feed.taste.learningOf(userId),
    // Your turn: the tab's dot, and the faces for "Send to a friend" in the share sheet.
    userId === null
      ? Promise.resolve(false)
      : sendsServices().hasNew(userId, () => isKnownAdultCaller(caller)),
    userId === null ? Promise.resolve(null) : sendsServices().friendsOf(userId),
  ]);
  return { first, launch, tune: learning === "on", news, friends };
};
