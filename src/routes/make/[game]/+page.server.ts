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
import type { ChangePart, FixCardData } from "../laid-out.ts";
import { ALL_PARTS, laidOut } from "../laid-out.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// A game's own address. A draft is not a screen of its own: it leads on to the first question not answered, or to the
// last step when none is left. Every other state is a screen that says where the game stands: Waiting, Sent back, Live and Taken off
// each have one (spec 5, 5b "Sent back, now", 5c); a game staff took down has only its headline.

/** The parts a game's answers are made of, as a count: the name, the line, the files, the two videos, who it is for and the websites. */
const PARTS = ALL_PARTS.length;

/** The answers a live game's maker may still change by herself (the rest go through staff again): the same two the service allows. */
const LIVE_CHANGEABLE: readonly ChangePart[] = ["name", "one_line"];

/**
 * The facts Live draws beside the game: who it is for (spec 5c, and the plan's rating chip). Its files
 * and websites are not for a player-facing screen, and a maker cannot change either from here.
 */
const LIVE_CHIPS: readonly string[] = ["age_rating"];

/**
 * One thing sent back, as its card shows it: where it is fixed and, for a video, the video itself. A live game's card for
 * a part its maker cannot answer (its files, mended on GitHub and sent as a new version) has no link: its question is a 404.
 */
function fixCards(game: MakerGame): FixCardData[] {
  // Not taken apart: a detached method loses its owner (the lint rule unbound-method).
  const services = gamesServices();
  return game.toFix.map((one) => ({
    part: one.part,
    title: one.title,
    words: one.words,
    note: one.note,
    // A video that was sent back opens its picker at once: the old video stays in its frame, and nothing is pressed first.
    href:
      game.state === "live" && !LIVE_CHANGEABLE.some((part) => part === one.part)
        ? null
        : `/make/${game.slug}/${questionOf(one.part)}${one.part === "upright_video" || one.part === "wide_video" ? "?again=1" : ""}`,
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

/** The game as Live lays it out: its name, line and the chip, with a Change on the two it may still change. */
function liveLaidOut(game: MakerGame) {
  const laid = laidOut(game, LIVE_CHANGEABLE);
  return { ...laid, chips: laid.chips.filter((chip) => LIVE_CHIPS.includes(chip.part)) };
}

/**
 * Which send a live game offers (spec 5c, and the Owner's "Send it again"). While an update waits, or nothing was sent
 * back, it is a new version, copied from GitHub. When staff sent files back it is still a new version: the files are
 * mended on GitHub and copied again. When they sent back a name or a line, nothing on GitHub changes, so
 * there is nothing to send until it is mended, and then the copy Ruken already holds is sent again.
 */
type LiveSend = "new_version" | "again" | "none";

function liveSend(game: MakerGame): LiveSend {
  // A copy GitHub refused leaves no new copy to send again, so the way on is a new copy: "Send it again" would be
  // refused with nothing to fix it (spec E4).
  if (game.hasPending || !game.sentBackLast || game.pullProblem !== null) return "new_version";
  if (game.toFix.some((one) => one.part === "files")) return "new_version";
  return game.toFix.length === 0 ? "again" : "none";
}

/** The line under "Live": what is wrong, or what to do next. */
function liveLine(game: MakerGame, send: LiveSend): string {
  if (game.hasPending) return "Your update is waiting for review.";
  if (game.pullProblem !== null) {
    return "Your last copy from GitHub didn't work. Fix it there, then send a new version.";
  }
  if (send === "again") return "Fixed. Send it again when you're ready.";
  if (game.toFix.length === 0) return "Players can find it on Ruken.";
  return send === "none" ? "Fix it, then send it again." : "Fix it, then send a new version.";
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
      // A refused newest copy leaves the older one waiting, so the screen says so and leads to where it is mended.
      filesProblem: game.pullProblem,
      filesAddress: `/make/${game.slug}/files`,
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
    const send = liveSend(game);
    return {
      ...base,
      view: "live" as const,
      line: liveLine(game, send),
      send,
      // An update waiting for review is replaced by the one sent now, which the note under the button says.
      updateWaiting: game.hasPending,
      fixes,
      // Asked on a screen of its own, because it cannot be undone.
      takeOffAddress: `/make/${game.slug}/take-off`,
      // The statement piece: the game's own video behind everything, in the shape of the screen it is seen on.
      backdrop: {
        upright: game.clips.upright === null ? null : gamesServices().media(game.clips.upright.key),
        wide: game.clips.wide === null ? null : gamesServices().media(game.clips.wide.key),
      },
      game: liveLaidOut(game),
    };
  }

  if (game.state === "taken_off") {
    return {
      ...base,
      view: "taken_off" as const,
      nextStep: nextStepWords({
        state: game.state,
        stateReason: game.reason,
        hasPending: game.hasPending,
        filesProblem: false,
        upright: true,
        wide: true,
      }),
      filesLeft: game.filesLeft,
    };
  }

  // Taken down by staff, and any other state without a screen of its own: its headline and the way back.
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

  // A live game's update that staff sent back and its maker mended is sent again as it is: the copy Ruken already holds,
  // with no copy from GitHub, which would change nothing about a line she has just fixed.
  sendAgain: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "live") error(404, "Not found");
    if (liveSend(game) !== "again") return fail(400, { problem: "That game can't be sent again right now." });
    try {
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },

  // A game its maker took off is copied again and sent for review like a new game; only a person's yes makes it live.
  putBack: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "taken_off") error(404, "Not found");
    try {
      await gamesServices().service.putBack(game.id, userId);
    } catch (problem) {
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },

  // Files a delete that stopped left in the bucket, deleted again.
  deleteLeft: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "taken_off") error(404, "Not found");
    try {
      await gamesServices().service.deleteLeftFiles(game.id, userId);
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
