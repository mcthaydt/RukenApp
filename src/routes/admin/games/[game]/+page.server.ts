import { error, fail, redirect, type Cookies } from "@sveltejs/kit";
import {
  acceptAnywayWords,
  acceptProblem,
  CHECKED_NOTE,
  decisionWords,
  mustAskBeforeAccepting,
  partsToCheck,
  playedWords,
  staffOnly,
  TICK_FIRST_WORDS,
  tickProblem,
  waitedWords,
  type Decision,
} from "../../../../features/admin/admin.ts";
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
// stranger, or a member who is not staff, meets a missing page here, on the page and on a decision posted by hand. A game
// that is not waiting any more (a colleague decided it a moment ago) is not a missing page for staff: it sends them back
// to the list and says so.

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
  /** Staff already said "Accept it anyway" for a game they had not played, so they are not asked a second time. */
  anyway: boolean;
};

/** What a refusal is about, besides its words: the part it belongs to, and whether it is a question. */
type RefusalAbout = {
  /** The part the words are about, so the page can show them there. */
  at?: GamePart;
  /** The refusal is about the marks inside "Who it's for", so the page shows it under their question. */
  atMarks?: boolean;
  /** The one refusal that is a question, "Accept it anyway?". */
  asking?: boolean;
};

/**
 * A refusal always has the same shape. Two differently shaped failures would be folded by the compiler into the one
 * with fewer fields, and the page would lose `kept` from its `form`.
 */
function refused(problem: string, kept?: Kept, about: RefusalAbout = {}) {
  return fail(400, {
    problem,
    kept,
    at: about.at,
    atMarks: about.atMarks === true,
    asking: about.asking === true,
  });
}

/** Leaves the line the list says once: what this decision did. It is read and deleted by the next look at the list. */
function tell(cookies: Cookies, decision: Decision, name: string): void {
  cookies.set(CHECKED_NOTE.name, decisionWords(decision, name), {
    path: CHECKED_NOTE.path,
    httpOnly: true,
    sameSite: "lax",
    maxAge: CHECKED_NOTE.maxAgeSeconds,
  });
}

/** The game is not waiting any more: back to the list with a word, and not a page that is not there. */
function backToTheList(cookies: Cookies, name: string): never {
  tell(cookies, "not_waiting", name);
  redirect(303, "/admin/games");
}

export const load: PageServerLoad = async ({ locals, params, cookies }) => {
  const { userId } = staffOnly(locals.caller);
  const games = gamesServices();
  const game = await games.service.gameForReview(params.game);
  if (game === null) error(404, "Not found");
  // A game with nothing waiting has nothing to check: a link from an old list, or the browser's Back after deciding.
  if (game.pending === null) backToTheList(cookies, game.name);

  const play = playServices().service;
  const started = await play.startReviewPlay({
    game: { id: game.id, publicId: game.publicId },
    pullId: game.pending.id,
    staffUserId: userId,
  });
  // Only this staff member's play of these waiting files: "you've played it" is not players' time on the live files.
  const summary = await play.playSummary(game.id, { pullId: game.pending.id, userId });

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
  decide: async ({ locals, params, request, cookies }) => {
    const { userId } = staffOnly(locals.caller);
    const games = gamesServices();
    const service = games.service;
    const game = await service.gameForReview(params.game);
    if (game === null) error(404, "Not found");
    // Another staff member decided it first: this one's page was drawn before that, so nothing here is theirs to decide.
    if (game.pending === null) backToTheList(cookies, game.name);

    const form = await request.formData();
    const seen = textOf(form, "seen");
    const ticked = form.getAll("wrong").filter((one): one is string => typeof one === "string");
    const ageRating = textOf(form, "ageRating");
    const marks = form.getAll("mark").filter((one): one is string => typeof one === "string");
    const confirmed = textOf(form, "acceptAnyway") === "1";
    const reasons = typedBy(form, ticked, "reason");
    const notes = typedBy(form, ticked, "note");
    // What was ticked and typed is kept in every refusal, so nothing has to be done twice.
    const kept: Kept = { ticked, ageRating, marks, reasons, notes, anyway: confirmed };

    if (ticked.length > 0) {
      // The service refuses a part with no reason as well; this says which part, which its words cannot.
      const titles = new Map(
        partsToCheck(game, (key) => games.media(key)).map((one) => [one.part, one.title]),
      );
      const missing = tickProblem(
        ticked.map((part) => ({
          part: part as GamePart,
          reason: reasons[part] ?? "",
          note: notes[part] ?? "",
        })),
        (part) => titles.get(part) ?? part,
      );
      if (missing !== null) return refused(missing.words, kept, { at: missing.part });
    } else if (game.pullProblem !== null) {
      // The page offers only Send back for this game, so an empty press is an old page or a post by hand.
      return refused(TICK_FIRST_WORDS, kept);
    } else {
      // Refused before it is asked about, so staff are never asked "Accept it anyway?" for a press that would be refused.
      const unfinished = acceptProblem({ ageRating, marks }, game.name);
      if (unfinished !== null)
        return refused(unfinished.words, kept, { at: unfinished.part, atMarks: unfinished.atMarks });
      // Read now and not from the page's line, so a game played since the page was drawn is not asked about.
      const played = await playServices().service.playSummary(game.id, {
        pullId: game.pending.id,
        userId,
      });
      if (mustAskBeforeAccepting(played.countedSeconds, confirmed))
        return refused(acceptAnywayWords(game.name), { ...kept, anyway: true }, { asking: true });
    }

    try {
      if (ticked.length === 0) {
        // The choices come from a form and are never believed: the service refuses a rating or a mark it does not know.
        await service.accept(game.id, userId, {
          ageRating: ageRating as AgeRating,
          contentMarks: marks as ContentMark[],
          seen,
        });
        tell(cookies, game.state === "live" ? "accepted_update" : "accepted_game", game.name);
      } else {
        await service.sendBack(
          game.id,
          userId,
          ticked.map((part) => ({
            part: part as GamePart,
            reason: reasons[part] ?? "",
            note: notes[part] ?? "",
          })),
          seen,
        );
        tell(cookies, "sent_back", game.name);
      }
    } catch (problem) {
      if (!(problem instanceof GameError)) throw problem;
      // A game that changed is looked at again from the top: what was ticked was ticked for what staff saw before.
      if (problem.message === GAME_CHANGED_WORDS) return refused(problem.message);
      // An Accept the service refuses for its words is about who it is for: the rating and its marks are all it reads.
      const at = ticked.length === 0 && problem.code === "INVALID" ? "age_rating" : undefined;
      return refused(problem.message, kept, { at });
    }
    redirect(303, "/admin/games");
  },
} satisfies Actions;
