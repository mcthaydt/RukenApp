import { isKnownAdult } from "./age.ts";
import type { Caller } from "./caller.ts";
import { authServices } from "./services.ts";

/**
 * The words an 18+ game's refusal is thrown with, for the error page to choose its lines and its one button by. They
 * are codes, never shown: someone not signed in is asked to sign in, anyone else is told the game is for adults.
 */
export const ADULTS_ONLY = {
  signedOut: "adults-only:signed-out",
  notAdult: "adults-only:not-adult",
} as const;

/**
 * Whether this caller is known to be 18 or over today. Not signed in, under 18 and an account with no age are all
 * no. Only asked where an 18+ game is about to be shown, so other pages read nothing.
 */
export async function isKnownAdultCaller(caller: Caller): Promise<boolean> {
  if (caller.kind !== "user") return false;
  const services = authServices();
  return isKnownAdult(services.prisma, services.clock, caller.userId);
}

/**
 * The refusal for an 18+ game this caller may not see, or null when they may. Every route that shows or plays a game
 * asks this before it reads anything else about the game.
 */
export async function adultsOnlyRefusal(
  ageRating: string | null,
  caller: Caller,
): Promise<(typeof ADULTS_ONLY)[keyof typeof ADULTS_ONLY] | null> {
  if (ageRating !== "age_18") return null;
  if (caller.kind !== "user") return ADULTS_ONLY.signedOut;
  return (await isKnownAdultCaller(caller)) ? null : ADULTS_ONLY.notAdult;
}
