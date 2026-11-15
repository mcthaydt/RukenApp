// The end of `/make/<game>/<question>`: only the nine words a question is asked by. `check`, `agreement` and
// `throw-away` are routes of their own, and any other word is a page that does not exist.
//
// The words are written out here, not read from the games feature: a matcher runs in the browser too, and the
// feature's entry carries server code the browser must not load. tests/params/question.test.ts holds this list to the
// feature's own, so the two cannot drift apart.
const WORDS: readonly string[] = [
  "name",
  "line",
  "files",
  "plays-on",
  "upright",
  "wide",
  "age",
  "marks",
  "websites",
];

export function match(param: string): boolean {
  return WORDS.includes(param);
}
