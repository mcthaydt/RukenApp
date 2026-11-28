import { error, fail, redirect } from "@sveltejs/kit";
import {
  answersOf,
  firstUnanswered,
  GameError,
  gamesServices,
  liveSendOf,
  type LiveSend,
  nextStepWords,
  waitingLine,
  partNoun,
  questionOf,
  toFixWords,
  type MakerGame,
} from "../../../features/games/games.ts";
import { isOpen, launchServices, wishlistCountWords } from "../../../features/launch/launch.ts";
import { ownGame } from "../own-game.server.ts";
import type { ChangePart, FixCardData } from "../laid-out.ts";
import { ALL_PARTS, laidOut } from "../laid-out.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// A game's own address. A draft is not a screen of its own: it leads on to the first question not answered, or to the
// last step when none is left. Every other state is a screen that says where the game stands: Waiting, Sent back, Live and Taken off
// each have one (spec 5, 5b "Sent back, now", 5c); a game staff took down has only its headline. Waiting and Taken off
// can also throw the game away.

/** The parts a game's answers are made of, as a count: the name, the line, the files, the two videos, who it is for and the websites. */
const PARTS = ALL_PARTS.length;

/**
 * The answers a live game's maker may change, the same ones the service allows. The name and the line show to players
 * at once. A change to the files or the websites is copied, and a new video or rating is held apart, each sent for
 * review in the one save, while players keep what staff last said yes to.
 */
const LIVE_CHANGEABLE: readonly ChangePart[] = [
  "name",
  "one_line",
  "files",
  "upright_video",
  "wide_video",
  "age_rating",
  "other_websites",
];

/** The facts Live draws beside the game: who it is for, and the two she may change (where its files are, its websites). */
const LIVE_CHIPS: readonly string[] = ["files", "age_rating", "other_websites"];

/**
 * One thing sent back, as its card shows it: where it is fixed and, for a video, the video itself. A live game's card
 * shows the video that was refused, which is the one that waited for a yes.
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
    href: `/make/${game.slug}/${questionOf(one.part)}${one.part === "upright_video" || one.part === "wide_video" ? "?again=1" : ""}`,
    video: videoOfCard(game, one.part, (key) => services.media(key)),
    // What the button above the cards says when this is the first thing to fix.
    fixWords: `Fix ${partNoun(one.part)}`,
  }));
}

/** The video a card for a sent-back video shows: the one that waited if there is one, else the one in the frame. */
function videoOfCard(game: MakerGame, part: string, media: (key: string) => string): FixCardData["video"] {
  if (part === "upright_video") {
    const clip = game.heldClips.upright ?? game.clips.upright;
    return clip === null ? null : { src: media(clip.key), shape: "upright" };
  }
  if (part === "wide_video") {
    const clip = game.heldClips.wide ?? game.clips.wide;
    return clip === null ? null : { src: media(clip.key), shape: "wide" };
  }
  return null;
}

/** The game as Live lays it out: its name, line and the chip, with a Change on the two it may still change. */
function liveLaidOut(game: MakerGame) {
  const laid = laidOut(game, LIVE_CHANGEABLE);
  return { ...laid, chips: laid.chips.filter((chip) => LIVE_CHIPS.includes(chip.part)) };
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
  const { userId, game } = await ownGame(event);
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
      line: waitingLine(await gamesServices().service.decisionDayWordsFor(game.id)),
      changeAddress: `/make/${game.slug}/check`,
      // Quiet, under "Change something": what waits is cleared, and a decision held for decision day lapses.
      throwAway: `/make/${game.slug}/throw-away`,
      // A refused newest copy leaves the older one waiting, so the screen says so and leads to where it is mended.
      filesProblem: game.pullProblem,
      filesAddress: `/make/${game.slug}/files`,
      testPlay: game.testPlay ? `/make/${game.slug}/play` : null,
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
    // The statement piece: the game's own video behind everything, in the shape of the screen it is seen on.
    const backdrop = {
      upright: game.clips.upright === null ? null : gamesServices().media(game.clips.upright.key),
      wide: game.clips.wide === null ? null : gamesServices().media(game.clips.wide.key),
    };
    // The first look at a game a decision day let in is the Accepted screen, once.
    const accepted = await gamesServices().service.acceptedScreenFor(game.id);
    if (accepted !== null) return { ...base, view: "accepted" as const, count: accepted.count, backdrop };
    const send = liveSendOf(game);
    // How many people want it, counted from stored rows each time (wishlist spec, "What a maker sees").
    const launch = launchServices();
    const before = !isOpen(launch.now(event.cookies));
    const wished = wishlistCountWords(await launch.wishlist.countFor(game.id, userId), before);
    return {
      ...base,
      view: "live" as const,
      line: liveLine(game, send),
      send,
      // A new copy of the files waiting for review is replaced by the one sent now, which the note under the button says.
      updateWaiting: game.newCopyWaits,
      fixes,
      // Asked on a screen of its own, because it cannot be undone.
      takeOffAddress: `/make/${game.slug}/take-off`,
      pageAddress: `/g/${game.slug}`,
      // The maker's way to play it: the files waiting for review, else the live copy (before launch the game's own page
      // shows Wishlist where Play goes, for its maker too).
      testPlay: game.testPlay ? `/make/${game.slug}/play` : null,
      // Playtesting is before launch only (playtesting spec).
      playtestersAddress: before ? `/make/${game.slug}/playtesters` : null,
      backdrop,
      game: liveLaidOut(game),
      showsPlayerCount: game.showsPlayerCount,
      wished,
    };
  }

  if (game.state === "taken_off") {
    return {
      ...base,
      view: "taken_off" as const,
      connectAddress: `/make/github?choose=1&game=${game.slug}`,
      nextStep: nextStepWords({
        state: game.state,
        stateReason: game.reason,
        hasPending: game.hasPending,
        filesProblem: false,
        upright: true,
        wide: true,
      }),
      filesLeft: game.filesLeft,
      // Laid out as Sent back is, with a Change on every part: nothing changed here reaches players unchecked, because
      // putting the game back sends it for review.
      game: laidOut(game, ALL_PARTS),
      // Quiet, at the foot: the game and its videos are deleted for good, on the screen that asks first.
      throwAway: `/make/${game.slug}/throw-away`,
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

/** What Live says when Ruken can't see a game's repository on GitHub: press the Change beside it. */
function cantSeeOnLive(repoFullName: string): string {
  return `Ruken can't see your game on GitHub any more. Press Change next to ${repoFullName} to add it again.`;
}

/** The refusal a screen shows above its button: a game's own words, and any other failure is a failure. */
function refusal(problem: unknown): { problem: string } {
  if (problem instanceof GameError) return { problem: problem.message };
  throw problem;
}

export const actions: Actions = {
  // "See your game" on the Accepted screen: it has been seen, so the next look is Live.
  seen: async (event) => {
    const { game } = await ownGame(event);
    await gamesServices().service.markAcceptedSeen(game.id);
    redirect(303, `/make/${game.slug}`);
  },
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
    if (liveSendOf(game) !== "again")
      return fail(400, { problem: "That game can't be sent again right now." });
    try {
      await gamesServices().service.sendForReview(game.id, userId);
    } catch (problem) {
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },

  // The maker's switch for the player count on the game's page. It posts the state it wants, so a second press of an
  // old page says the same thing twice and changes nothing more.
  playerCount: async (event) => {
    const { userId, game } = await ownGame(event);
    if (game.state !== "live") error(404, "Not found");
    const wanted = (await event.request.formData()).get("show");
    if (wanted !== "on" && wanted !== "off") return fail(400, { problem: "That didn't work. Try again." });
    await gamesServices().service.setShowsPlayerCount(game.id, userId, wanted === "on");
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
      // Ruken can't see the repository. On Live the way to mend that is the Change beside the game's files, which
      // leads to choosing it on GitHub, so the words point there (the owner's direction: no new button).
      if (problem instanceof GameError && problem.code === "NOT_CONNECTED" && game.repoFullName !== null) {
        return fail(400, { problem: cantSeeOnLive(game.repoFullName) });
      }
      return fail(400, refusal(problem));
    }
    redirect(303, `/make/${game.slug}`);
  },
};
