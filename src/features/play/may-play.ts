// Who may play, and why (stub: the code comes after its tests have been seen failing).

export type PlayBasis = "member" | "free_game" | "staff" | "own_game";

export interface PlayViewer {
  userId: string;
  isStaff: boolean;
  isMember: boolean;
}

export function playBasis(input: {
  game: { freeToPlay: boolean; makerUserId: string };
  viewer: PlayViewer | null;
}): PlayBasis | null {
  throw new Error(`not built yet: playBasis ${String(input.game.freeToPlay)}`);
}

/** True when the browser says it is a phone. */
export function isPhone(userAgent: string | null): boolean {
  throw new Error(`not built yet: isPhone ${String(userAgent)}`);
}

/** Where "Not now" on the paywall goes back to. */
export function backFromPaywall(next: string): string {
  throw new Error(`not built yet: backFromPaywall ${next}`);
}
