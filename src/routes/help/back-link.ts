import { safeNextPath } from "../../lib/safe-next.ts";

/**
 * The way back at the top and foot of a how-to: the page that sent the reader (`?from=`), or Ruken's front page. Only a
 * page of Ruken's own is believed, so a link to a how-to can never lead off the site. The words name where it goes, so
 * a maker who came from the guide is not told they are going back to a game.
 */
export function howToBack(url: URL): { href: string; words: string } {
  const from = safeNextPath(url.searchParams.get("from"));
  if (from === "/") return { href: "/", words: "Back to Ruken" };
  if (from === "/make") return { href: from, words: "Back to your games" };
  if (from === "/help") return { href: from, words: "Back to help" };
  if (from.startsWith("/help/")) return { href: from, words: "Back to the guide" };
  return { href: from, words: "Back to your game" };
}
