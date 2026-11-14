/** What went wrong, in a code the screens can act on; the message is in words for a person. */
export type GameErrorCode = "INVALID" | "NOT_FOUND" | "NOT_CONNECTED" | "FILES_REFUSED" | "NOT_READY";

// Its own file so the GitHub client and the service can both throw it without importing each other.
export class GameError extends Error {
  readonly code: GameErrorCode;
  /** The box of the new-game form the words are about, when they are about one: the form shows them under it. */
  readonly field: "name" | "oneLine" | "repo" | "branch" | "folder" | undefined;

  constructor(code: GameErrorCode, message: string, field?: GameError["field"]) {
    super(message);
    this.name = "GameError";
    this.code = code;
    this.field = field;
  }
}
