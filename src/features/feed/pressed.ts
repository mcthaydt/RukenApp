import type { Cookies } from "@sveltejs/kit";
import { isMarkKind, type MarkKind } from "./marks.ts";

// A press of Like, Save or Repost that has to wait: for the cookie yes, for sign-in, or both (learned-feed spec, G5:
// "'I agree' carries on to sign in or to the press"). The press is named in the way back, `/me/press?game=…&kind=…`,
// and in a short cookie set only by a press itself: the feed's press while signed out, or "I agree" on the notice the
// press opened. The way back makes the press only when the two agree, so a link to it from anywhere presses nothing.

const PRESSED_COOKIE = "rk_mark_pressed";
const PRESSED_FOR_SECONDS = 30 * 60;

export interface WaitingPress {
  game: string;
  kind: MarkKind;
}

/** The way back that makes the press, once the person has said yes and signed in. */
export function pressPath(press: WaitingPress): string {
  return `/me/press?game=${encodeURIComponent(press.game)}&kind=${press.kind}`;
}

/** The press a way-back address names, or null for any other address. */
export function pressOfPath(path: string): WaitingPress | null {
  let url: URL;
  try {
    url = new URL(path, "http://x");
  } catch {
    return null;
  }
  if (url.pathname !== "/me/press") return null;
  const game = url.searchParams.get("game");
  const kind = url.searchParams.get("kind");
  return game !== null && game !== "" && isMarkKind(kind) ? { game, kind } : null;
}

const valueOf = (press: WaitingPress): string => `${press.kind}:${press.game}`;

/** Notes that this person pressed, so the way back may make it. */
export function rememberPress(cookies: Cookies, press: WaitingPress): void {
  cookies.set(PRESSED_COOKIE, valueOf(press), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: PRESSED_FOR_SECONDS,
  });
}

/** True, once, when the press named here is the one the person made; the note goes either way. */
export function takePress(cookies: Cookies, press: WaitingPress): boolean {
  const noted = cookies.get(PRESSED_COOKIE);
  if (noted === undefined) return false;
  cookies.delete(PRESSED_COOKIE, { path: "/" });
  return noted === valueOf(press);
}
