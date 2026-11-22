import { feedServices } from "../features/feed/feed.ts";
import { launchServices } from "../features/launch/launch.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): the clips in order, as whole addresses. No game to show is an empty list, and the screen says so.
// Before launch each clip shows Wishlist where Play goes.
export const load: PageServerLoad = async ({ locals, cookies }) => ({
  clips: await feedServices().service.feed(),
  launch: await launchServices().screenFor(
    locals.caller.kind === "user" ? locals.caller.userId : null,
    cookies,
  ),
});
