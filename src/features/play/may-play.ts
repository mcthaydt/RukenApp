// Who may play, and why. All of it is pure: the page that starts a play asks these, and the answers say what to record
// (the reason a play was allowed) and where to send a person who may not play.

/** Why a play was allowed. Only `member` plays count for pay (design 6). */
export type PlayBasis = "member" | "free_game" | "staff" | "own_game";

/** The person who pressed Play, as the page knows them. */
export interface PlayViewer {
  userId: string;
  isStaff: boolean;
  isMember: boolean;
}

/**
 * Why this person may play this game, or null when they may not (the paywall). When more than one reason holds, the
 * first of own game, staff, free game and member wins: design 6 says the first three never count for pay, so a member's
 * play of a free game must not be recorded as a member's.
 */
export function playBasis(input: {
  game: { freeToPlay: boolean; makerUserId: string };
  viewer: PlayViewer | null;
}): PlayBasis | null {
  const { game, viewer } = input;
  if (viewer !== null && viewer.userId === game.makerUserId) return "own_game";
  if (viewer?.isStaff === true) return "staff";
  if (game.freeToPlay) return "free_game";
  if (viewer?.isMember === true) return "member";
  return null;
}

/**
 * What the browser says it is: a phone (`Mobi` is in an iPhone's and most Androids' User-Agent), a tablet (an iPad, or an
 * Android with no `Mobile`), or a computer. An iPad that says it is a Mac is told apart by the page's script.
 */
export function deviceOf(userAgent: string | null): "phone" | "tablet" | "computer" {
  const says = userAgent ?? "";
  if (/iPad|Tablet/.test(says) || (/Android/.test(says) && !/Mobile/.test(says))) return "tablet";
  if (/Mobi/.test(says)) return "phone";
  return "computer";
}

/** A game's page address ends in a slug: lower-case letters and digits in runs joined by hyphens, 3 to 40 characters. */
const GAME_ADDRESS = /^\/g\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:\/play)?$/;

/**
 * The game a paywall's `next` names, when it is that game's page or its Play address and nothing else, or null. The address
 * comes from a link and is not believed, so a slug outside the shape a game's address can have is no game.
 */
export function gameSlugOfNext(next: string): string | null {
  const slug = GAME_ADDRESS.exec(next)?.[1];
  return slug !== undefined && slug.length >= 3 && slug.length <= 40 ? slug : null;
}

/** Where "Not now" on the paywall goes: back to the game's page when the person came from that game, else the front page. */
export function backFromPaywall(next: string): string {
  const slug = gameSlugOfNext(next);
  return slug === null ? "/" : `/g/${slug}`;
}
