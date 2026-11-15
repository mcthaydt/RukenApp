import type { AgeRating, ContentMark, GamePart, GamePlaysOn } from "../../lib/server/db.ts";

// A game is made one question at a time (spec 3 and 10.5): which question comes next, the counter over the heading,
// and which part of a game each question answers (the part staff can send back). Pure rules, so the screens stay thin.

/** Every question a game is asked, in the order they are asked. "marks" is asked only of an 18+ game. */
export const QUESTIONS = ["name", "line", "files", "plays-on", "upright", "wide", "age", "marks"] as const;
export type QuestionId = (typeof QUESTIONS)[number];

/** A question that is only ever changed from Check and send, so it has no place in the count. */
export type ChangeOnlyId = "websites";

/** What a game has been answered so far: only what the next-question rules need. */
export interface Answers {
  oneLine: string | null;
  /** True when the game has a pull and its last pull was not refused. */
  hasFiles: boolean;
  playsOn: GamePlaysOn | null;
  upright: boolean;
  wide: boolean;
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
}

/** The questions this game is asked, in order: seven, or eight with "marks" for an 18+ game. */
export function questionsFor(answers: Pick<Answers, "ageRating">): QuestionId[] {
  return QUESTIONS.filter((question) => question !== "marks" || answers.ageRating === "age_18");
}

/** Whether the game already holds an answer to `question`. The name is given before the first question is shown. */
export function isAnswered(question: QuestionId, answers: Answers): boolean {
  switch (question) {
    case "name":
      return true;
    case "line":
      return answers.oneLine !== null;
    case "files":
      return answers.hasFiles;
    case "plays-on":
      return answers.playsOn !== null;
    case "upright":
      return answers.upright;
    case "wide":
      return answers.wide;
    case "age":
      return answers.ageRating !== null;
    case "marks":
      return answers.contentMarks.length > 0;
  }
}

/** The first question this game has not been answered, or null when every one has. */
export function firstUnanswered(answers: Answers): QuestionId | null {
  return questionsFor(answers).find((question) => !isAnswered(question, answers)) ?? null;
}

/** The place of `question` among this game's questions. */
export function counterOf(question: QuestionId, answers: Answers): { n: number; of: number } {
  const asked = questionsFor(answers);
  const place = asked.indexOf(question);
  // A question the game is not asked (the marks of a 12+ game) has no place; the screen is a 404 before this is read.
  return { n: place === -1 ? asked.length : place + 1, of: asked.length };
}

/** The question before `question`, or null from the first (and for a question this game is not asked). */
export function questionBefore(question: QuestionId, answers: Answers): QuestionId | null {
  const place = questionsFor(answers).indexOf(question);
  return place <= 0 ? null : (questionsFor(answers)[place - 1] ?? null);
}

const PART_OF: Record<QuestionId | ChangeOnlyId, GamePart> = {
  name: "name",
  line: "one_line",
  files: "files",
  "plays-on": "plays_on",
  upright: "upright_video",
  wide: "wide_video",
  age: "age_rating",
  marks: "age_rating",
  websites: "other_websites",
};

/** The part of a game that a question answers. The age and the marks are both the age rating. */
export function partOf(question: QuestionId | ChangeOnlyId): GamePart {
  return PART_OF[question];
}

/** The question that fixes a part: the age rating opens at "age", whose Next leads on to "marks" for an 18+ game. */
export function questionOf(part: GamePart): QuestionId | ChangeOnlyId {
  const found = (Object.keys(PART_OF) as (QuestionId | ChangeOnlyId)[]).find(
    (question) => PART_OF[question] === part && question !== "marks",
  );
  // Every part has a question; a part added without one fails the test that walks them all.
  if (found === undefined) throw new Error(`no question fixes the part ${part}`);
  return found;
}

/** The rows of a game that tell which questions it has been answered: what the maker's page already holds. */
export interface AnswerSource {
  oneLine: string | null;
  playsOn: GamePlaysOn | null;
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
  pullProblem: string | null;
  newestPull: object | null;
  clips: { upright: object | null; wide: object | null };
}

/** What a game has been answered so far, read from its rows. */
export function answersOf(game: AnswerSource): Answers {
  throw new Error(`not built yet: answersOf ${JSON.stringify(game)}`);
}
