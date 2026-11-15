import { error, fail, redirect } from "@sveltejs/kit";
import {
  ageProblem,
  answersOf,
  clipRequestTooBig,
  connectHostsFrom,
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
  ratingWords,
  type AgeRating,
  type Answer,
  type ClipShape,
  type ContentMark,
  type GamePlaysOn,
  type MakerGame,
} from "../../../../features/games/games.ts";
import { ownGame } from "../../own-game.server.ts";
import type { Actions, PageServerLoad } from "./$types";

// One question of a game: its page, and the form that answers it. Each action finds the game among the signed-in
// maker's own, so another maker's game is a 404 for every question (Review Focus 2).

/** The questions that have a screen. "websites" is reached only from Check and send, so it is never in the count. */
const BUILT = ["name", "line", "files", "plays-on", "upright", "wide", "age", "marks", "websites"] as const;
type BuiltQuestion = (typeof BUILT)[number];

/** The two questions answered with a video: its word is the shape of the clip. */
type VideoQuestion = Extract<BuiltQuestion, ClipShape>;

function isVideoQuestion(question: BuiltQuestion): question is VideoQuestion {
  return question === "upright" || question === "wide";
}

function isBuilt(word: string): word is BuiltQuestion {
  const built: readonly string[] = BUILT;
  return built.includes(word);
}

/** The questions a live game's maker may still answer by herself; the rest go through staff again (slice 4). */
const LIVE_MAY_ANSWER: readonly BuiltQuestion[] = ["name", "line", "plays-on"];

/**
 * The question this address asks of this game, or a 404: a word with no screen, marks for a game that is not 18+, or a
 * question a live game is not asked (its videos, files, rating and websites are not changed under the players).
 */
function askedQuestion(word: string, game: MakerGame, madeEighteen: boolean): BuiltQuestion {
  if (!isQuestionAddress(word) || !isBuilt(word)) error(404, "Not found");
  if (word === "marks" && game.ageRating !== "age_18" && !madeEighteen) error(404, "Not found");
  if (game.state === "live" && !LIVE_MAY_ANSWER.includes(word)) error(404, "Not found");
  return word;
}

/**
 * True when a waiting or sent-back game that is not 18+ is being made 18+: its marks are asked before the rating is kept,
 * because the database holds an 18+ game that is past draft to having them. A draft is asked its marks next, as always.
 * `said` is the maker's own word that this is what she is doing (the address's `age=18`, or the form's hidden `age`).
 */
function isBeingMadeEighteen(game: MakerGame, said: boolean): boolean {
  return said && (game.state === "waiting" || game.state === "sent_back") && game.ageRating !== "age_18";
}

/**
 * True while a draft still has a question not answered: the first time through, with the counter and Next. The websites
 * are never the first time through: a game is asked them only when its maker chooses to change them.
 */
function isFirstTime(game: MakerGame, question: BuiltQuestion): boolean {
  return question !== "websites" && game.state === "draft" && firstUnanswered(answersOf(game)) !== null;
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
    // A waiting game has been copied already: Next copies it again, and staff go on with the newest copy.
    copiesAgain: game.state === "waiting",
  };
}

/** The video question's own part of the page: the video that is in (none until one is), and whether it is being changed. */
function videoScreen(url: URL, game: MakerGame, shape: VideoQuestion) {
  const clip = game.clips[shape];
  const howToRecord = `/help/record-screen?from=${encodeURIComponent(`/make/${game.slug}/${shape}`)}`;
  return {
    src: clip === null ? null : gamesServices().media(clip.key),
    // Set by "Choose a different video": the picker is open and the video that is there stays in its frame.
    replacing: clip !== null && url.searchParams.get("again") === "1",
    replaceAddress: `/make/${game.slug}/${shape}?again=1`,
    // The how-to's way back is this question.
    howToRecord,
    // The same how-to, at its part for a video that is too big.
    howToTooBig: `${howToRecord}#too-big`,
    computersOnly: game.playsOn === "computer_only",
  };
}

export const load: PageServerLoad = async (event) => {
  const { userId, game } = await ownGame(event);
  const madeEighteen = isBeingMadeEighteen(game, event.url.searchParams.get("age") === "18");
  const question = askedQuestion(event.params.question, game, madeEighteen);
  const answers = answersOf(game);
  const firstTime = isFirstTime(game, question);

  // A question after the first one not answered (a bookmark, a second tab) leads back to that one.
  const first = firstUnanswered(answers);
  if (firstTime && first !== null) {
    const asked: readonly string[] = questionsFor(answers);
    if (asked.indexOf(question) > asked.indexOf(first)) redirect(303, `/make/${game.slug}/${first}`);
  }

  const before = question === "websites" ? null : questionBefore(question, answers);
  return {
    question,
    name: game.name,
    // What the card beside the question shows of the game as it is saved.
    preview: {
      name: game.name,
      oneLine: game.oneLine ?? "",
      rating: ratingWords(game.ageRating, game.contentMarks),
      video: game.clips.upright === null ? null : gamesServices().media(game.clips.upright.key),
      wideVideo: game.clips.wide === null ? null : gamesServices().media(game.clips.wide.key),
    },
    // One website to a line, as the game's list was typed.
    servers: game.connectHosts.join("\n"),
    oneLine: game.oneLine ?? "",
    playsOn: game.playsOn === null ? [] : [game.playsOn],
    ageRating: game.ageRating === null ? [] : [game.ageRating],
    contentMarks: game.contentMarks,
    // Set while a waiting or sent-back game is being made 18+: the marks form says so, so the rating and the marks are
    // kept together.
    madeEighteen,
    // The address of a live game's page never changes, and the name's hint says so.
    addressStays: game.everLive,
    counter: firstTime && question !== "websites" ? counterOf(question, answers) : null,
    // The age question's count follows the rating being picked: an 18+ game is asked one question more (its marks), so a maker
    // who picks 18+ is told there are 8 at once, not after pressing Next.
    ageCounters:
      firstTime && question === "age"
        ? {
            eighteen: counterOf(question, { ...answers, ageRating: "age_18" }),
            younger: counterOf(question, { ...answers, ageRating: "age_12" }),
          }
        : null,
    back: !firstTime ? `/make/${game.slug}` : before === null ? "/make" : `/make/${game.slug}/${before}`,
    // Only a draft and a game sent back can be thrown away; a waiting or live game has no such link.
    throwAway:
      game.state === "draft" || game.state === "sent_back" ? `/make/${game.slug}/throw-away` : undefined,
    files: question === "files" ? await filesScreen(event.url, userId, game) : null,
    video: isVideoQuestion(question) ? videoScreen(event.url, game, question) : null,
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

/** The one line as typed: a new line (a paste, or a keyboard with no script) is a space, so a line stays one line. */
function oneLineOf(form: FormData): string {
  return textOf(form, "oneLine").replace(/\s*[\r\n]+\s*/g, " ");
}

/** What was typed in the question's one box, to come back with a refusal. */
function typedFor(question: BuiltQuestion, form: FormData): string {
  switch (question) {
    case "name":
      return textOf(form, "name");
    case "line":
      return oneLineOf(form);
    case "websites":
      return textOf(form, "servers");
    default:
      return "";
  }
}

/** The answer in this form, or the words for why there is none. What was typed is never believed. */
function answerFrom(
  question: Exclude<BuiltQuestion, VideoQuestion>,
  form: FormData,
): { answer: Answer } | { problem: string } {
  switch (question) {
    case "websites": {
      const servers = connectHostsFrom(textOf(form, "servers"));
      return "problem" in servers
        ? { problem: servers.problem }
        : { answer: { question, connectHosts: servers.hosts } };
    }
    case "name":
      return { answer: { question, name: textOf(form, "name") } };
    case "line":
      return { answer: { question, oneLine: oneLineOf(form) } };
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

/** Where a saved answer goes on: back to the game when it is being changed, else the next question or the last step. */
async function goOn(userId: string, saved: { slug: string }, question: BuiltQuestion, firstTime: boolean) {
  if (!firstTime || question === "websites") redirect(303, `/make/${saved.slug}`);
  // The next question this game is asked, or the last step when there is none (its rating may have changed which
  // questions it is asked).
  const fresh = await gamesServices().service.gameForMaker(saved.slug, userId);
  if (fresh === null) error(404, "Not found");
  const asked: readonly string[] = questionsFor(answersOf(fresh));
  redirect(303, `/make/${saved.slug}/${asked[asked.indexOf(question) + 1] ?? "check"}`);
}

// Every action is named: SvelteKit refuses a page that has a default action beside a named one, and the video is sent
// by its own action (`clip`) while the answer to a question is sent by `answer`.
export const actions: Actions = {
  answer: async (event) => {
    const { userId, game } = await ownGame(event);
    const form = await event.request.formData();
    const madeEighteen = isBeingMadeEighteen(game, textOf(form, "age") === "18");
    const question = askedQuestion(event.params.question, game, madeEighteen);
    const firstTime = isFirstTime(game, question);

    // A video is added the moment it is chosen (the `clip` action), so Next only moves on, and only with one in.
    if (isVideoQuestion(question)) {
      if (game.clips[question] === null) return fail(400, { problem: "Choose a video first.", value: "" });
      return goOn(userId, game, question, firstTime);
    }

    // What was typed comes back with a refusal, so nobody types it twice.
    const typed = typedFor(question, form);
    const found = answerFrom(question, form);
    if ("problem" in found) return fail(400, { problem: found.problem, value: typed });

    // A waiting or sent-back game made 18+ is asked its marks first, and nothing is kept until they are answered.
    if (
      found.answer.question === "age" &&
      found.answer.ageRating === "age_18" &&
      isBeingMadeEighteen(game, true)
    ) {
      redirect(303, `/make/${game.slug}/marks?age=18`);
    }
    // The marks of that game come with the rating, in one answer.
    const answer: Answer =
      found.answer.question === "marks" && madeEighteen
        ? { question: "age", ageRating: "age_18", contentMarks: found.answer.contentMarks }
        : found.answer;

    let saved: { slug: string };
    try {
      saved = await gamesServices().service.saveAnswer(game.id, userId, answer);
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
    return goOn(userId, saved, question, firstTime);
  },

  // One video, one request. A refusal shows under the hint of the question that asked.
  clip: async (event) => {
    const { game } = await ownGame(event);
    const shape = askedQuestion(event.params.question, game, false);
    if (!isVideoQuestion(shape)) error(404, "Not found");
    // Refused before the body is read, so a huge file is never held in the Worker. A request that says no length (sent
    // in chunks) is refused too: only a hand-made one does, and its body could not be measured before it was read.
    if (clipRequestTooBig(event.request.headers.get("content-length"))) {
      return fail(413, { problem: "A video can be up to 30 MB.", value: "" });
    }
    const file = (await event.request.formData()).get("clip");
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { problem: "Choose a video first.", value: "" });
    }
    try {
      await gamesServices().service.saveClip(game.id, shape, {
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    } catch (problem) {
      if (problem instanceof GameError) return fail(400, { problem: problem.message, value: "" });
      throw problem;
    }
    redirect(303, `/make/${game.slug}/${shape}`);
  },
};
