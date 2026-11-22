/** Something to tell the person in plain words, and stop. The command line prints `words` and exits with 1. */
export class Told extends Error {
  /** @param {string} words */
  constructor(words) {
    super(words);
    this.name = "Told";
  }
}
