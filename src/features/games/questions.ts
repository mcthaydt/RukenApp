import type { AgeRating, ContentMark, GamePart, GamePlaysOn } from "../../lib/server/db.ts";

// Not built yet: each stub throws, so the red run fails in the tests that name them and nowhere else.
export const QUESTIONS = ["name", "line", "files", "plays-on", "upright", "wide", "age", "marks"] as const;
export type QuestionId = (typeof QUESTIONS)[number];
export type ChangeOnlyId = "websites";
export interface Answers {
  oneLine: string | null;
  hasFiles: boolean;
  playsOn: GamePlaysOn | null;
  upright: boolean;
  wide: boolean;
  ageRating: AgeRating | null;
  contentMarks: ContentMark[];
}
export function questionsFor(answers: Pick<Answers, "ageRating">): QuestionId[] {
  throw new Error(`not built yet: questionsFor ${JSON.stringify(answers)}`);
}
export function isAnswered(question: QuestionId, answers: Answers): boolean {
  throw new Error(`not built yet: isAnswered ${question} ${JSON.stringify(answers)}`);
}
export function firstUnanswered(answers: Answers): QuestionId | null {
  throw new Error(`not built yet: firstUnanswered ${JSON.stringify(answers)}`);
}
export function counterOf(question: QuestionId, answers: Answers): { n: number; of: number } {
  throw new Error(`not built yet: counterOf ${question} ${JSON.stringify(answers)}`);
}
export function questionBefore(question: QuestionId, answers: Answers): QuestionId | null {
  throw new Error(`not built yet: questionBefore ${question} ${JSON.stringify(answers)}`);
}
export function partOf(question: QuestionId | ChangeOnlyId): GamePart {
  throw new Error(`not built yet: partOf ${question}`);
}
export function questionOf(part: GamePart): QuestionId | ChangeOnlyId {
  throw new Error(`not built yet: questionOf ${part}`);
}
