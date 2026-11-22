import { feedServices } from "../features/feed/feed.ts";
import type { PageServerLoad } from "./$types";

// The feed (spec 5.1): the clips in order, as whole addresses. No game to show is an empty list, and the screen says so.
export const load: PageServerLoad = async () => ({ clips: await feedServices().service.feed() });
