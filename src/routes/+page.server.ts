import { feedServices } from "../features/feed/feed.ts";
import { isKnownAdultCaller } from "../features/accounts/accounts.ts";
import { launchServices } from "../features/launch/launch.ts";
import { playtestServices } from "../features/playtest/playtest.ts";
import { sendsServices } from "../features/sends/sends.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): its first page of clips in order, as whole addresses, and the address of the page after it. No
// game to show is an empty page, and the screen says so. Before launch each clip shows Wishlist where Play goes. A
// signed-in person whose feed learns from them gets More and Less like this on each clip; a browser that has not said
// yes to cookies is never signed in here, so it is never offered them.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const feed = feedServices();
  const userId = locals.caller.kind === "user" ? locals.caller.userId : null;
  const caller = locals.caller;
  const launchNow = launchServices().now(cookies);
  const isAdult = () => isKnownAdultCaller(caller);
  const [first, launch, learning, news, friends, playtest] = await Promise.all([
    feed.askingOf(caller, cookies).then((asking) => feed.service.page(null, asking, feed.viewerOf(caller))),
    launchServices().screenFor(userId, cookies),
    userId === null ? Promise.resolve(null) : feed.taste.learningOf(userId),
    // Your turn: the tab's dot (a sent game or a playtest row), and the faces for "Send to a friend" in the share sheet.
    userId === null
      ? Promise.resolve(false)
      : Promise.all([
          sendsServices().hasNew(userId, isAdult),
          playtestServices().service.hasNew(userId, isAdult, launchNow),
        ]).then(([sent, playtest]) => sent || playtest),
    userId === null ? Promise.resolve(null) : sendsServices().friendsOf(userId),
    // The badge and a playtester's Play, for every game at once, so the feed's later pages show them too.
    playtestServices().service.feedStateFor(userId, launchNow),
  ]);
  return { first, launch, tune: learning === "on", news, friends, playtest };
};
