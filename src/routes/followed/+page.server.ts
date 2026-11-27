import { feedServices } from "../../features/feed/feed.ts";
import { isKnownAdultCaller } from "../../features/accounts/accounts.ts";
import { launchServices } from "../../features/launch/launch.ts";
import { sendsServices } from "../../features/sends/sends.ts";
import type { PageServerLoad } from "./$types";

// The Followed tab (src/features/feed/Followed.svelte): signed out it asks the person to sign in; signed in it holds the
// live games of the makers they follow, played like the feed, or says they follow nobody yet, or that none of those
// makers has a game live.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const caller = locals.caller;
  if (caller.kind !== "user") return { signedIn: false as const };
  const sends = sendsServices();
  const [{ following, page }, launch, news, friends] = await Promise.all([
    feedServices().service.followedPage(caller.userId),
    launchServices().screenFor(caller.userId, cookies),
    // Your turn: the tab's dot, and the faces for "Send to a friend" in the share sheet.
    sends.hasNew(caller.userId, () => isKnownAdultCaller(caller)),
    sends.friendsOf(caller.userId),
  ]);
  return { signedIn: true as const, following, first: page, launch, news, friends };
};
