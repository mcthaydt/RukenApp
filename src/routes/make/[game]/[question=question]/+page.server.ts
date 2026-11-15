import { error, fail, redirect } from "@sveltejs/kit";
import {
  ageProblem,
  answersOf,
  counterOf,
  firstUnanswered,
  GameError,
  gamesServices,
  isMissingIndexHtml,
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
const BUILT = ["name", "line", "files", "plays-on", "age", "marks"] as const;
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

/** What a refused copy says: plain words for the file every game needs, and the copy's own words for the rest. */
interface Refusal {
  missingIndex: boolean;
  words: string;
}

function refusalOf(problem: string): Refusal {
  return { missingIndex: isMissingIndexHtml(problem), words: problem };
}

/** The files question's own part of the page: what GitHub has told Ruken about this maker, and where the game stands. */
async function filesScreen(url: URL, userId: string, game: MakerGame) {
  const { service } = gamesServices();
  const folder = `/make/${game.slug}/files`;
  const howTo = `/help/github?from=${encodeURIComponent(folder)}`;
  return {
    connected: await service.hasConnectedGitHub(userId),
    repositories: (await service.repositoriesFor(userId)).map((repository) => repository.fullName),
    // Set when GitHub sent her back without the connection finished.
    connectionFailed: url.searchParams.get("github") === "failed",
    // Set by "Pick another folder": the boxes are open and the folder is ready to be typed in.
    changing: url.searchParams.get("change") === "1",
    chosen: game.repoFullName === null ? [] : [game.repoFullName],
    branch: game.repoBranch ?? "",
    folder: game.repoFolder,
    refusal: game.pullProblem === null ? null : refusalOf(game.pullProblem),
    // `data-sveltekit-reload` links: a server redirect to GitHub, not a page of the app.
    connectAddress: `/make/github?choose=1&game=${game.slug}`,
    howToAddress: howTo,
    folderHowToAddress: `${howTo}#folder`,
    changeAddress: `${folder}?change=1`,
  };
}

export const load: PageServerLoad = async (event) => {
  const { userId, game } = await ownGame(event);
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
    files: question === "files" ? await filesScreen(event.url, userId, game) : null,
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

/** The words for the box of the files question that a refusal is about; a refusal about no box is about the rows. */
function filesProblemsOf(problem: GameError): { repo?: string; branch?: string; folder?: string } {
  if (problem.field === "branch") return { branch: problem.message };
  if (problem.field === "folder") return { folder: problem.message };
  return { repo: problem.message };
}

/** What was typed for the files question; it comes back with a refusal, so nobody types it twice. */
function filesTypedIn(form: FormData) {
  return {
    repo: textOf(form, "repo"),
    branch: textOf(form, "branch").trim(),
    folder: textOf(form, "folder").trim(),
  };
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
    case "files": {
      const { repo, branch, folder } = filesTypedIn(form);
      return {
        answer: { question, repo: { fullName: repo, branch: branch === "" ? null : branch, folder } },
      };
    }
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
      if (!(problem instanceof GameError)) throw problem;
      if (question !== "files") return fail(400, { problem: problem.message, value: typed });
      // The copy was refused: not a box to fix but a game to fix, so the screen says what is wrong with it. Any other
      // refusal is about one of the boxes and shows beside it.
      const asked = filesTypedIn(form);
      if (problem.code === "FILES_REFUSED")
        return fail(400, { value: typed, asked, refusal: refusalOf(problem.message) });
      return fail(400, { value: typed, asked, problems: filesProblemsOf(problem) });
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
