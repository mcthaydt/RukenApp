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

/** True when the browser says it is a phone. A phone's User-Agent has `Mobi` (iPhone, most Androids) or `Android`. */
export function isPhone(userAgent: string | null): boolean {
  return /Mobi|Android/.test(userAgent ?? "");
}

/** A game's page address ends in a slug: lower-case letters and digits in runs joined by hyphens, 3 to 40 characters. */
const PLAY_ADDRESS = /^\/g\/([a-z0-9]+(?:-[a-z0-9]+)*)\/play$/;

/**
 * Where "Not now" on the paywall goes: back to the game's page when the person came from that game's Play address, and
 * to the front page for anything else, since the address comes from a link and is not believed.
 */
export function backFromPaywall(next: string): string {
  const slug = PLAY_ADDRESS.exec(next)?.[1];
  return slug !== undefined && slug.length >= 3 && slug.length <= 40 ? `/g/${slug}` : "/";
}
