import { feedServices } from "../../features/feed/feed.ts";
import { launchServices } from "../../features/launch/launch.ts";
import type { PageServerLoad } from "./$types";

// The Followed tab (src/features/feed/Followed.svelte): signed out it asks the person to sign in; signed in it holds the
// live games of the makers they follow, played like the feed, or says they follow nobody yet, or that none of those
// makers has a game live.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  if (locals.caller.kind !== "user") return { signedIn: false as const };
  const { following, page } = await feedServices().service.followedPage(locals.caller.userId);
  return {
    signedIn: true as const,
    following,
    first: page,
    launch: await launchServices().screenFor(locals.caller.userId, cookies),
  };
};
