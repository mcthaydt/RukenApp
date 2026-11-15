import { error, fail, redirect } from "@sveltejs/kit";
import {
  answersOf,
  firstUnanswered,
  GameError,
  gamesServices,
  nextStepWords,
  partNoun,
  questionOf,
  toFixWords,
  type MakerGame,
} from "../../../features/games/games.ts";
import { ownGame } from "../own-game.server.ts";
import type { FixCardData } from "../laid-out.ts";
import { ALL_PARTS, laidOut } from "../laid-out.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// A game's own address. A draft is not a screen of its own: it leads on to the first question not answered, or to the
// last step when none is left. Every other state is a screen that says where the game stands: Waiting, Sent back and Live
// each have one (spec 5, 5b "Sent back, now", 5c); a game off Ruken has only its headline.

/** The parts a game's answers are made of, as a count: the name, the line, the files, where it plays, the two videos, who it is for and the websites. */
const PARTS = ALL_PARTS.length;

/** The answers a live game's maker may still change by herself (the rest go through staff again): the same three the service allows. */
const LIVE_CHANGEABLE = ["name", "one_line", "plays_on"] as const;

/** One thing sent back, as its card shows it: where it is fixed and, for a video, the video itself. */
function fixCards(game: MakerGame): FixCardData[] {
  // Not taken apart: a detached method loses its owner (the lint rule unbound-method).
  const services = gamesServices();
  return game.toFix.map((one) => ({
    part: one.part,
    title: one.title,
    words: one.words,
    note: one.note,
    // A video that was sent back opens its picker at once: the old video stays in its frame, and nothing is pressed first.
    href: `/make/${game.slug}/${questionOf(one.part)}${one.part === "upright_video" || one.part === "wide_video" ? "?again=1" : ""}`,
    video:
      one.part === "upright_video" && game.clips.upright !== null
        ? { src: services.media(game.clips.upright.key), shape: "upright" as const }
        : one.part === "wide_video" && game.clips.wide !== null
          ? { src: services.media(game.clips.wide.key), shape: "wide" as const }
          : null,
    // What the button above the cards says when this is the first thing to fix.
    fixWords: `Fix ${partNoun(one.part)}`,
  }));
}

export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  if (game.state === "draft") {
    redirect(303, `/make/${game.slug}/${firstUnanswered(answersOf(game)) ?? "check"}`);
  }
  const base = { name: game.name, headline: game.headline };
  const fixes = fixCards(game);

  if (game.state === "waiting") {
    // Changing anything goes through Check and send, where the game is laid out and sent again.
    return {
      ...base,
      view: "waiting" as const,
      game: laidOut(game, []),
      changeAddress: `/make/${game.slug}/check`,
    };
  }

  if (game.state === "sent_back") {
    return {
      ...base,
      view: "sent_back" as const,
      line: toFixWords(fixes.length) ?? "Fixed. Send it again when you're ready.",
      fixes,
      // Only the first thing to fix is named on the button; the cards below hold the rest.
      accepted: { count: PARTS - fixes.length, ready: fixes.length === 0 },
      game: laidOut(game, ALL_PARTS),
      throwAway: `/make/${game.slug}/throw-away`,
    };
  }

  if (game.state === "live") {
    return {
      ...base,
      view: "live" as const,
      line: game.hasPending
        ? "Your update is waiting for review."
        : fixes.length > 0
          ? "Fix it, then send a new version."
          : "Players can find it on Ruken.",
      fixes,
      seeAddress: `/g/${game.slug}`,
      // The statement piece: the game's own video behind everything, in the shape of the screen it is seen on.
      backdrop: {
        upright: game.clips.upright === null ? null : gamesServices().media(game.clips.upright.key),
        wide: game.clips.wide === null ? null : gamesServices().media(game.clips.wide.key),
      },
      game: laidOut(game, LIVE_CHANGEABLE),
    };
  }

  // Off Ruken: its headline and the way back, and no more until its own screens are built.
  return {
    ...base,
    view: "plain" as const,
    nextStep: nextStepWords({
      state: game.state,
      stateReason: game.reason,
      hasPending: game.hasPending,
      filesProblem: game.pullProblem !== null,
      upright: game.clips.upright !== null,
      wide: game.clips.wide !== null,
    }),
  };
};

/** The refusal a screen shows above its button: a game's own words, and any other failure is a failure. */
function refusal(problem: unknown): { problem: string } {
  if (problem instanceof GameError) return { problem: problem.message };
  throw problem;
}

export const actions: Actions = {
  // A game that was sent back is sent again once everything that was sent back is fixed; the service says so in its own
  // words when something is left, so a send posted by hand is refused the same way.
  send: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "sent_back") return fail(400, { problem: "That game can't be sent right now." });
    try {
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },

  // A live game's newest files are copied and sent for review in the one press; its old files stay live meanwhile.
  newVersion: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "live") error(404, "Not found");
    try {
      await gamesServices().service.pullLatest(game.id);
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },
};
