import { MAKER_AGREEMENT_TEXT, parseAgreement } from "../../../features/make/make.ts";
import type { PageServerLoad } from "./$types";

// The maker agreement, word for word from the Owner's file. It needs no account: a maker reads it before agreeing.

/**
 * Where "Back" goes. A maker who came from a game's page (`?back=/make/<game>`) goes back to it; anyone else goes to
 * the maker's games. Only a game's page in the maker's area is believed, so the link can never lead off Ruken.
 */
const GAME_PAGE = /^\/make\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const load: PageServerLoad = ({ url }) => {
  const back = url.searchParams.get("back") ?? "";
  // The version and the date come from the file's own title line, and its points are split where the file numbers them.
  const { version, updated, points } = parseAgreement(MAKER_AGREEMENT_TEXT);
  return {
    version,
    updated,
    points,
    back: GAME_PAGE.test(back)
      ? { href: back, words: "Back to your game" }
      : { href: "/make", words: "Back to your games" },
  };
};
