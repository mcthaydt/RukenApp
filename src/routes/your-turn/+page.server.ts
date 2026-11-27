import { isKnownAdultCaller } from "../../features/accounts/accounts.ts";
import { sendsServices } from "../../features/sends/sends.ts";
import type { PageServerLoad } from "./$types";

// The Your turn tab (games-sent-to-you brief): the games friends sent this person, newest first. It only reads, so it
// opens like Followed before the cookie yes (plan audit 3): signed out it asks the person to sign in, and the page, once
// shown to a signed-in person, marks the list seen by posting to /your-turn/seen.
export const load: PageServerLoad = async ({ locals }) => {
  const caller = locals.caller;
  if (caller.kind !== "user") return { signedIn: false as const };
  const sends = sendsServices();
  const adult = () => isKnownAdultCaller(caller);
  const [games, news] = await Promise.all([
    sends.listOf(caller.userId, adult),
    sends.hasNew(caller.userId, adult),
  ]);
  return {
    signedIn: true as const,
    news,
    games: games.map((game) => ({ ...game, sentAt: game.sentAt.toISOString() })),
  };
};
