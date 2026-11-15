import type { AgeRating, ContentMark, GamePart, GamePlaysOn } from "../../lib/server/db.ts";

// Not built yet: the stubs keep the red run's failures to the tests that name them.
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
  void answers;
  return [];
}
export function isAnswered(question: QuestionId, answers: Answers): boolean {
  void [question, answers];
  return false;
}
export function firstUnanswered(answers: Answers): QuestionId | null {
  void answers;
  return null;
}
export function counterOf(question: QuestionId, answers: Answers): { n: number; of: number } {
  void [question, answers];
  return { n: 0, of: 0 };
}
export function questionBefore(question: QuestionId, answers: Answers): QuestionId | null {
  void [question, answers];
  return null;
}
export function partOf(question: QuestionId | ChangeOnlyId): GamePart {
  void question;
  return "name";
}
export function questionOf(part: GamePart): QuestionId | ChangeOnlyId {
  void part;
  return "name";
}
