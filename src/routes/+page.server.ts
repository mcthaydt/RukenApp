import { feedServices } from "../features/feed/feed.ts";
import { launchServices } from "../features/launch/launch.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): its first page of clips in order, as whole addresses, and the address of the page after it. No
// game to show is an empty page, and the screen says so. Before launch each clip shows Wishlist where Play goes.
export const load: PageServerLoad = async ({ locals, cookies }) => ({
  first: await feedServices().service.page(null),
  launch: await launchServices().screenFor(
    locals.caller.kind === "user" ? locals.caller.userId : null,
    cookies,
  ),
});
