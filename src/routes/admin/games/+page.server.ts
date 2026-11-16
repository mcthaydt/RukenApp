import { CHECKED_NOTE, staffOnly, waitedWords } from "../../../features/admin/admin.ts";
import { gamesServices } from "../../../features/games/games.ts";
import { systemClock } from "../../../lib/clock.ts";
import type { PageServerLoad } from "./$types";

// The games waiting for a person's yes, the oldest first. A maker has no handle until slice 3, so staff see the email.
export const load: PageServerLoad = async ({ locals, cookies }) => {
  staffOnly(locals.caller);
  const waiting = await gamesServices().service.waitingGames();
  const nowMs = systemClock.epochMs();
  // What the last decision was, said once: the note is gone the moment it is read, so a reload shows the plain list.
  const said = cookies.get(CHECKED_NOTE.name) ?? null;
  if (said !== null) cookies.delete(CHECKED_NOTE.name, { path: CHECKED_NOTE.path });
  return {
    said,
    games: waiting.map((game) => ({
      slug: game.slug,
      name: game.name,
      makerEmail: game.makerEmail,
      kind: game.kind,
      waited: waitedWords(game.sentAt, nowMs),
    })),
  };
};
