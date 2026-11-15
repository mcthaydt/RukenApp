import { error, fail, redirect } from "@sveltejs/kit";
import {
  ageProblem,
  answersOf,
  counterOf,
  firstUnanswered,
  GameError,
  gamesServices,
  isQuestionAddress,
  marksProblem,
  playsOnProblem,
  questionBefore,
  questionsFor,
  type AgeRating,
  type Answer,
  type ContentMark,
  type GamePlaysOn,
  type MakerGame,
  type QuestionId,
} from "../../../../features/games/games.ts";
import { ownGame } from "../../own-game.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// One question of a game: its page, and the form that answers it. Each action finds the game among the signed-in
// maker's own, so another maker's game is a 404 for every question (Review Focus 2).

/** The questions that have a screen so far. The rest are a 404 until the task that builds them. */
const BUILT = ["name", "line", "plays-on", "age", "marks"] as const;
type BuiltQuestion = (typeof BUILT)[number];

function isBuilt(word: string): word is BuiltQuestion {
  const built: readonly string[] = BUILT;
  return built.includes(word);
}

/** The question this address asks of this game, or a 404: a word with no screen, or marks for a game that is not 18+. */
function askedQuestion(word: string, game: MakerGame): BuiltQuestion {
  if (!isQuestionAddress(word) || !isBuilt(word)) error(404, "Not found");
  if (word === "marks" && game.ageRating !== "age_18") error(404, "Not found");
  return word;
}

/** True while a draft still has a question not answered: the first time through, with the counter and Next. */
function isFirstTime(game: MakerGame): boolean {
  return game.state === "draft" && firstUnanswered(answersOf(game)) !== null;
}

export const load: PageServerLoad = async (event) => {
  const { game } = await ownGame(event);
  const question = askedQuestion(event.params.question, game);
  const answers = answersOf(game);
  const firstTime = isFirstTime(game);

  // A question after the first one not answered (a bookmark, a second tab) leads back to that one.
  const first = firstUnanswered(answers);
  if (firstTime && first !== null) {
    const asked = questionsFor(answers);
    if (asked.indexOf(question) > asked.indexOf(first)) redirect(303, `/make/${game.slug}/${first}`);
  }

  const before = questionBefore(question, answers);
  return {
    question,
    name: game.name,
    oneLine: game.oneLine ?? "",
    playsOn: game.playsOn === null ? [] : [game.playsOn],
    ageRating: game.ageRating === null ? [] : [game.ageRating],
    contentMarks: game.contentMarks,
    // The address of a live game's page never changes, and the name's hint says so.
    addressStays: game.everLive,
    counter: firstTime ? counterOf(question, answers) : null,
    back: !firstTime ? `/make/${game.slug}` : before === null ? "/make" : `/make/${game.slug}/${before}`,
    throwAway: `/make/${game.slug}/throw-away`,
  };
};

/** A text field of the form, or "" when it is missing or is a file. */
function textOf(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function playsOnFrom(value: string): GamePlaysOn | null {
  return value === "phone_and_computer" || value === "computer_only" ? value : null;
}

function ageRatingFrom(value: string): AgeRating | null {
  return value === "age_3" ||
    value === "age_7" ||
    value === "age_12" ||
    value === "age_16" ||
    value === "age_18"
    ? value
    : null;
}

function contentMarksFrom(values: string[]): ContentMark[] {
  return values.filter(
    (value): value is ContentMark =>
      value === "sex_or_nudity" || value === "gore" || value === "drugs" || value === "none",
  );
}

/** The answer in this form, or the words for why there is none. What was typed is never believed. */
function answerFrom(question: BuiltQuestion, form: FormData): { answer: Answer } | { problem: string } {
  switch (question) {
    case "name":
      return { answer: { question, name: textOf(form, "name") } };
    case "line":
      return { answer: { question, oneLine: textOf(form, "oneLine") } };
    case "plays-on": {
      const playsOn = playsOnFrom(textOf(form, "playsOn"));
      return playsOn === null ? { problem: playsOnProblem(null) ?? "" } : { answer: { question, playsOn } };
    }
    case "age": {
      const ageRating = ageRatingFrom(textOf(form, "ageRating"));
      return ageRating === null ? { problem: ageProblem(null) ?? "" } : { answer: { question, ageRating } };
    }
    case "marks": {
      const contentMarks = contentMarksFrom(
        form.getAll("contentMarks").filter((value): value is string => typeof value === "string"),
      );
      const problem = marksProblem(contentMarks);
      return problem === undefined ? { answer: { question, contentMarks } } : { problem };
    }
  }
}

export const actions: Actions = {
  default: async (event) => {
    const { userId, game } = await ownGame(event);
    const question = askedQuestion(event.params.question, game);
    const form = await event.request.formData();
    // What was typed comes back with a refusal, so nobody types it twice.
    const typed =
      question === "name" ? textOf(form, "name") : question === "line" ? textOf(form, "oneLine") : "";
    const found = answerFrom(question, form);
    if ("problem" in found) return fail(400, { problem: found.problem, value: typed });

    const { service } = gamesServices();
    const firstTime = isFirstTime(game);
    let saved: { slug: string };
    try {
      saved = await service.saveAnswer(game.id, userId, found.answer);
    } catch (problem) {
      if (problem instanceof GameError) return fail(400, { problem: problem.message, value: typed });
      throw problem;
    }
    if (!firstTime) redirect(303, `/make/${saved.slug}`);

    // Going on: the next question this game is asked, or the last step when there is none (its rating may have
    // changed which questions it is asked).
    const fresh = await service.gameForMaker(saved.slug, userId);
    if (fresh === null) error(404, "Not found");
    const asked: QuestionId[] = questionsFor(answersOf(fresh));
    redirect(303, `/make/${saved.slug}/${asked[asked.indexOf(question) + 1] ?? "check"}`);
  },
};
