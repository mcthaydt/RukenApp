import { isKnownAdultCaller } from "../../features/accounts/accounts.ts";
import { launchServices } from "../../features/launch/launch.ts";
import { PLAYTEST_WORDS, playtestServices } from "../../features/playtest/playtest.ts";
import { sendsServices } from "../../features/sends/sends.ts";
import { TAB_DATA } from "../../features/feed/feed.ts";
import type { PageServerLoad } from "./$types";

// The Your turn tab (games-sent-to-you brief): the games friends sent this person, newest first. It only reads, so it
// opens like Followed before the cookie yes (plan audit 3): signed out it asks the person to sign in, and the page, once
// shown to a signed-in person, marks the list seen by posting to /your-turn/seen. Before launch a maker's yes or invite
// to playtest is a row here too (playtesting spec), with its line written here: sends sits below playtest and cannot
// read its words.
export const load: PageServerLoad = async ({ locals, cookies, depends }) => {
  // A tab shown from a page asked for ahead asks again quietly once it is in (src/features/feed/kept.svelte.ts).
  depends(TAB_DATA);
  const caller = locals.caller;
  if (caller.kind !== "user") return { signedIn: false as const };
  const sends = sendsServices();
  const playtest = playtestServices().service;
  const launchNow = launchServices().now(cookies);
  const adult = () => isKnownAdultCaller(caller);
  const [games, sentNews, notices, playtestNews] = await Promise.all([
    sends.listOf(caller.userId, adult),
    sends.hasNew(caller.userId, adult),
    playtest.noticesOf(caller.userId, adult, launchNow),
    playtest.hasNew(caller.userId, adult, launchNow),
  ]);
  const rows = [
    ...games.map((game) => ({ ...game, kind: "send" as const, line: null })),
    ...notices.map((notice) => {
      const maker = notice.maker ?? PLAYTEST_WORDS.someone;
      return {
        id: notice.id,
        slug: notice.slug,
        name: notice.name,
        still: notice.still,
        from: notice.maker,
        sentAt: notice.at,
        kind: "playtest" as const,
        line: notice.kind === "let" ? PLAYTEST_WORDS.letYou(maker) : PLAYTEST_WORDS.invitedYou(maker),
      };
    }),
  ].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  return {
    signedIn: true as const,
    news: sentNews || playtestNews,
    games: rows.map((row) => ({ ...row, sentAt: row.sentAt.toISOString() })),
  };
};
