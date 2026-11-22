import { feedServices } from "../features/feed/feed.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): its first page of clips in order, as whole addresses, and the address of the page after it. No
// game to show is an empty page, and the screen says so.
export const load: PageServerLoad = async () => ({
  first: await feedServices().service.page(null),
});
