import { isQuestionAddress } from "../features/games/questions.ts";

// The end of `/make/<game>/<question>`: only the nine words a question is asked by. `check`, `agreement` and
// `throw-away` are routes of their own, and any other word is a page that does not exist.
export function match(param: string): boolean {
  return isQuestionAddress(param);
}
