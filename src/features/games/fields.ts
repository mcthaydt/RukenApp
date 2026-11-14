// What is wrong with the fields of a new game, every one at once. Not built yet.

export type GameField = "name" | "oneLine" | "repo" | "branch" | "folder";

/** The words for each field that is wrong; a field that is fine is not there. */
export type GameFieldProblems = Partial<Record<GameField, string>>;

/** What a maker typed for a new game. */
export interface GameFieldsInput {
  name: string;
  oneLine: string;
  repo: { fullName: string; branch: string | null; folder: string };
}

export function gameFieldProblems(input: GameFieldsInput): GameFieldProblems {
  throw new Error(`gameFieldProblems is not built yet (${input.name})`);
}
