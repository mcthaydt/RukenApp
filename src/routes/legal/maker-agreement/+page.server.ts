import { MAKER_AGREEMENT_TEXT, MAKER_AGREEMENT_VERSION } from "../../../features/make/make.ts";
import type { PageServerLoad } from "./$types";

// The maker agreement, word for word from the Owner's file. It needs no account: a maker reads it before agreeing.

/** The file's first line is its title and version, which the page already shows as its heading and its note. */
const TITLE_LINE = /^Ruken maker agreement, version \d+$/;

/**
 * Where "Back" goes. A maker who came from a game's page (`?back=/make/<game>`) goes back to it; anyone else goes to
 * the maker's games. Only a game's page in the maker's area is believed, so the link can never lead off Ruken.
 */
const GAME_PAGE = /^\/make\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A numbered point starts with its own short title: "1. Your game stays yours." and then the point itself. */
const NUMBERED_POINT = /^(\d+\. [^.]+\.)\s+(.+)$/;

/** A point split at its title, so the page can set the title in bold on a line of its own. The words are the file's. */
function pointOf(line: string): { title: string | null; body: string } {
  const match = NUMBERED_POINT.exec(line);
  return match === null ? { title: null, body: line } : { title: match[1] ?? "", body: match[2] ?? "" };
}

export const load: PageServerLoad = ({ url }) => {
  const back = url.searchParams.get("back") ?? "";
  return {
    version: MAKER_AGREEMENT_VERSION,
    // Plain text, shown as paragraphs: the file puts each point on a line of its own, so a line is a paragraph.
    points: MAKER_AGREEMENT_TEXT.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !TITLE_LINE.test(line))
      .map(pointOf),
    back: GAME_PAGE.test(back)
      ? { href: back, words: "Back to your game" }
      : { href: "/make", words: "Back to your games" },
  };
};
