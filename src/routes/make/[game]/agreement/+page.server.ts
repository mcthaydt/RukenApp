import { redirect } from "@sveltejs/kit";
import { answersOf, firstUnanswered, questionsFor } from "../../../../features/games/games.ts";
import { agree, hasAgreed, MAKER_AGREEMENT_TEXT, parseAgreement } from "../../../../features/make/make.ts";
import { systemClock } from "../../../../lib/clock.ts";
import { prisma } from "../../../../lib/server/db.ts";
import { ownGame } from "../../own-game.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// The maker agreement, once, between a game's last question and Check and send (spec 5). Pressing "I agree" is the
// agreeing: there is no tick box. It is only for a maker who has not agreed yet; anyone else goes straight on.

export const load: PageServerLoad = async (event) => {
  const { userId, game } = await ownGame(event);
  const answers = answersOf(game);
  const asked = questionsFor(answers);
  // A game with a question still open is not at its end yet.
  const open = firstUnanswered(answers);
  if (open !== null) redirect(303, `/make/${game.slug}/${open}`);
  if (await hasAgreed(prisma(), userId)) redirect(303, `/make/${game.slug}/check`);

  // The version and the date come from the file's own title line, and its points are split where the file numbers them.
  const { version, updated, points } = parseAgreement(MAKER_AGREEMENT_TEXT);
  return {
    version,
    updated,
    points,
    // Back is the last question this game is asked, with its answer in place.
    back: `/make/${game.slug}/${asked[asked.length - 1] ?? "name"}`,
  };
};

export const actions: Actions = {
  // Recorded once: a second press (a reload of the form) adds nothing and leads on all the same.
  default: async (event) => {
    const { userId, game } = await ownGame(event);
    await agree(prisma(), systemClock, userId);
    redirect(303, `/make/${game.slug}/check`);
  },
};
