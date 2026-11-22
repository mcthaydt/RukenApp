import type { MakerGame } from "./service.ts";

/**
 * Which send a live game offers (spec 5c, and the Owner's "Send it again"). While an update waits, or nothing was sent
 * back, it is a new version, copied from GitHub. When staff sent files back it is still a new version: the files are
 * mended on GitHub and copied again. When they sent back a name or a line, nothing on GitHub changes, so
 * there is nothing to send until it is mended, and then the copy Ruken already holds is sent again.
 */
export type LiveSend = "new_version" | "again" | "none";

/** The one rule the game's screen and the maker's API both read, so the two can never offer different sends. */
export function liveSendOf(
  game: Pick<MakerGame, "hasPending" | "sentBackLast" | "pullProblem" | "toFix">,
): LiveSend {
  // A copy GitHub refused leaves no new copy to send again, so the way on is a new copy: "Send it again" would be
  // refused with nothing to fix it (spec E4).
  if (game.hasPending || !game.sentBackLast || game.pullProblem !== null) return "new_version";
  if (game.toFix.some((one) => one.part === "files")) return "new_version";
  return game.toFix.length === 0 ? "again" : "none";
}
