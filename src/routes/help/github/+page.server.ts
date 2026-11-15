import { safeNextPath } from "../../../lib/safe-next.ts";
import type { PageServerLoad } from "./$types";

// How to put a game on GitHub, for a maker who has never used it. It needs no account: someone reads it before they
// have one. The way back is the page that sent them (`?from=`), and only a page of Ruken's own is believed, so the
// link can never lead off the site.
export const load: PageServerLoad = ({ url }) => {
  const from = safeNextPath(url.searchParams.get("from"));
  return from === "/"
    ? { back: { href: "/", words: "Back to Ruken" } }
    : { back: { href: from, words: "Back to your game" } };
};
