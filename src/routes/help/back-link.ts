import { safeNextPath } from "../../lib/safe-next.ts";

/**
 * The way back at the top and foot of a how-to: the page that sent the reader (`?from=`), or Ruken's front page. Only a
 * page of Ruken's own is believed, so a link to a how-to can never lead off the site.
 */
export function howToBack(url: URL): { href: string; words: string } {
  const from = safeNextPath(url.searchParams.get("from"));
  return from === "/" ? { href: "/", words: "Back to Ruken" } : { href: from, words: "Back to your game" };
}
