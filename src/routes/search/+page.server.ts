import { feedServices, SEARCH_LONGEST } from "../../features/feed/feed.ts";
import type { PageServerLoad } from "./$types";

// Search from the feed's top bar (src/features/feed/Search.svelte): `q` is what the person typed. With none, nothing is
// looked up and the screen asks what to find.
export const load: PageServerLoad = async ({ url }) => {
  const query = (url.searchParams.get("q") ?? "").slice(0, SEARCH_LONGEST).trim();
  return {
    query,
    found: query === "" ? null : await feedServices().search.find(query),
    longest: SEARCH_LONGEST,
  };
};
