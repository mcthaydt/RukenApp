import { fail, redirect } from "@sveltejs/kit";
import {
  answersOf,
  firstUnanswered,
  GameError,
  gamesServices,
  type MakerGame,
} from "../../../../features/games/games.ts";
import { hasAgreed, sendWhenAgreed } from "../../../../features/make/make.ts";
import { prisma } from "../../../../lib/server/db.ts";
import { ownGame } from "../../own-game.server.ts";
import { ALL_PARTS, laidOut } from "../../laid-out.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// Check and send, the last step (spec 5): the game laid out as members will see it, with a Change on every part, and
// the one button that sends it. It is reached only with every answer in and the agreement agreed to, so sending is not
// refused for a reason the maker could not see coming (spec stall 12): anything short of that is led to what is missing.

/** The address this game's maker is led to when it is not ready to be checked, or null when it is. */
async function whereItIsNotReady(userId: string, game: MakerGame): Promise<string | null> {
  // Only a game not yet sent, or waiting, is checked here; every other game has a screen of its own.
  if (game.state !== "draft" && game.state !== "waiting") return `/make/${game.slug}`;
  const open = firstUnanswered(answersOf(game));
  if (open !== null) return `/make/${game.slug}/${open}`;
  if (!(await hasAgreed(prisma(), userId))) return `/make/${game.slug}/agreement`;
  return null;
}

export const load: PageServerLoad = async (event) => {
  const { userId, game } = await ownGame(event);
  const elsewhere = await whereItIsNotReady(userId, game);
  if (elsewhere !== null) redirect(303, elsewhere);
  return {
    name: game.name,
    game: laidOut(game, ALL_PARTS),
    // A waiting game was sent already, and a change to it is saved at once, so there is nothing to send here: pressing
    // "Send for review" again would only put it at the back of staff's queue.
    changing: game.state === "waiting",
    doneAddress: `/make/${game.slug}`,
    // A waiting game cannot be thrown away (it is with staff); a draft can.
    throwAway: game.state === "draft" ? `/make/${game.slug}/throw-away` : null,
    // The maker can try the files before sending them (or while they wait).
    testPlay: game.testPlay ? `/make/${game.slug}/play` : null,
  };
};

export const actions: Actions = {
  send: async (event) => {
    const { userId, game } = await ownGame(event);
    // A game that was sent already is not sent again from here: its changes are saved.
    if (game.state === "waiting") redirect(303, `/make/${game.slug}`);
    // A send posted by hand gets the same lead as the page: nothing goes to staff that was not checked.
    const elsewhere = await whereItIsNotReady(userId, game);
    if (elsewhere !== null) redirect(303, elsewhere);
    try {
      await sendWhenAgreed(prisma(), gamesServices().service, game.id, userId);
    } catch (problem) {
      // The service's refusal is in its own words, shown under the heading.
      if (problem instanceof GameError) return fail(400, { problem: problem.message });
      throw problem;
    }
    redirect(303, `/make/${game.slug}`);
  },
};
