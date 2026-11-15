import { error, fail, redirect } from "@sveltejs/kit";
import { partsToCheck, playedWords, staffOnly, waitedWords } from "../../../../features/admin/admin.ts";
import {
  FILES_BEING_FIXED_WORDS,
  GAME_CHANGED_WORDS,
  GameError,
  gamesServices,
  type AgeRating,
  type ContentMark,
  type GamePart,
} from "../../../../features/games/games.ts";
import { GAME_FRAME_ALLOW, GAME_FRAME_SANDBOX, playServices } from "../../../../features/play/play.ts";
import { systemClock } from "../../../../lib/clock.ts";
import type { Actions, PageServerLoad } from "./$types";

// Checking a game: staff play it, read each part, and either accept it or send it back with a reason for each part they
// ticked. One form, and what was ticked decides which: nothing ticked is an Accept, anything ticked is a Send back. A
// stranger, or a member who is not staff, meets a missing page here, on the page and on a decision posted by hand.

/** What the staff member's form said, as strings, for every part they ticked. Never believed: the service checks each. */
function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** What was typed for each ticked part, under `<prefix>-<part>`. Typed as pairs of strings so the record is not `any`. */
function typedBy(form: FormData, parts: readonly string[], prefix: string): Record<string, string> {
  const typed: Record<string, string> = {};
  for (const part of parts) typed[part] = textOf(form, `${prefix}-${part}`);
  return typed;
}

/** What was ticked and typed before a refusal, so the page can come back as it was left. */
type Kept = {
  ticked: string[];
  ageRating: string;
  marks: string[];
  reasons: Record<string, string>;
  notes: Record<string, string>;
};

/**
 * A refusal always has the same shape. Two differently shaped failures would be folded by the compiler into the one
 * with fewer fields, and the page would lose `kept` from its `form`.
 */
function refused(problem: string, kept?: Kept) {
  return fail(400, { problem, kept });
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const { userId } = staffOnly(locals.caller);
  const games = gamesServices();
  const game = await games.service.gameForReview(params.game);
  // A game with nothing waiting has nothing to check; so does one that is not there.
  if (game === null || game.pending === null) error(404, "Not found");

  const play = playServices().service;
  const started = await play.startReviewPlay({
    game: { id: game.id, publicId: game.publicId },
    pullId: game.pending.id,
    staffUserId: userId,
  });
  const summary = await play.playSummary(game.id);

  return {
    slug: game.slug,
    name: game.name,
    kind: game.state === "live" ? ("update" as const) : ("game" as const),
    makerEmail: game.makerEmail,
    waited: waitedWords(game.sentAt ?? new Date(systemClock.epochMs()), systemClock.epochMs()),
    seen: game.seen,
    parts: partsToCheck(game, (key) => games.media(key)),
    ageRating: game.ageRating,
    contentMarks: game.contentMarks,
    computerOnly: game.playsOn === "computer_only",
    // Accept is refused while the newest copy of the files was refused; the page says so before it is pressed.
    filesBeingFixed: game.pullProblem === null ? null : FILES_BEING_FIXED_WORDS,
    frame: { src: started.frameUrl, sandbox: GAME_FRAME_SANDBOX, allow: GAME_FRAME_ALLOW },
    played: playedWords(summary.countedSeconds),
  };
};

// `satisfies`, not an annotation: the page's `form` takes its type from what the action really returns.
export const actions = {
  decide: async ({ locals, params, request }) => {
    const { userId } = staffOnly(locals.caller);
    const service = gamesServices().service;
    const game = await service.gameForReview(params.game);
    if (game === null || game.pending === null) error(404, "Not found");

    const form = await request.formData();
    const seen = textOf(form, "seen");
    const ticked = form.getAll("wrong").filter((one): one is string => typeof one === "string");
    const ageRating = textOf(form, "ageRating");
    const marks = form.getAll("mark").filter((one): one is string => typeof one === "string");

    try {
      if (ticked.length === 0) {
        // The choices come from a form and are never believed: the service refuses a rating or a mark it does not know.
        await service.accept(game.id, userId, {
          ageRating: ageRating as AgeRating,
          contentMarks: marks as ContentMark[],
          seen,
        });
      } else {
        await service.sendBack(
          game.id,
          userId,
          ticked.map((part) => ({
            part: part as GamePart,
            reason: textOf(form, `reason-${part}`),
            note: textOf(form, `note-${part}`),
          })),
          seen,
        );
      }
    } catch (problem) {
      if (!(problem instanceof GameError)) throw problem;
      // A game that changed is looked at again from the top: what was ticked was ticked for what staff saw before.
      if (problem.message === GAME_CHANGED_WORDS) return refused(problem.message);
      // The page is shown again with what was ticked and typed kept, so nothing has to be done twice.
      return refused(problem.message, {
        ticked,
        ageRating,
        marks,
        reasons: typedBy(form, ticked, "reason"),
        notes: typedBy(form, ticked, "note"),
      });
    }
    redirect(303, "/admin/games");
  },
} satisfies Actions;
