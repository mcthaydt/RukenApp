import { GameError } from "./game-error.ts";
import { checkBranch, checkRepo } from "./github.ts";
import { slugOf } from "./ids.ts";

// What is wrong with the fields of a new game, every one at once, so a maker fixes the whole form in one go and each
// refusal sits under its own box. The games service throws the first of them, so its own guard stays.

export type GameField = "name" | "oneLine" | "repo" | "branch" | "folder";

/** The words for each field that is wrong; a field that is fine is not there. */
export type GameFieldProblems = Partial<Record<GameField, string>>;

/** What a maker typed for a new game. */
export interface GameFieldsInput {
  name: string;
  oneLine: string;
  repo: { fullName: string; branch: string | null; folder: string };
}

export const NAME_MAX = 60;
export const ONE_LINE_MAX = 100;

/** The words of a check that throws a `GameError`, or undefined when it passes. Anything else is a bug and goes on. */
function problemOf(check: () => void): string | undefined {
  try {
    check();
  } catch (error) {
    if (error instanceof GameError) return error.message;
    throw error;
  }
  return undefined;
}

/** Throws unless `folder` is a folder inside a repository: "" for the top, no slash at either end, no `..` step. */
export function checkFolder(folder: string): void {
  if (
    folder.length > 200 ||
    folder.startsWith("/") ||
    folder.endsWith("/") ||
    folder.split("/").includes("..")
  ) {
    throw new GameError(
      "INVALID",
      "That doesn't look like a folder. Write it like web/build, with no slash at the start or end.",
      "folder",
    );
  }
}

/** The words for the name, or undefined when it is fine. */
function nameProblem(name: string): string | undefined {
  if (name === "") return "A game needs a name.";
  if (name.length > NAME_MAX) return "A game's name can be up to 60 characters.";
  if (slugOf(name) === null) return "Pick a name with at least three letters or numbers.";
  return undefined;
}

/** The words for the one line, or undefined when it is fine. */
function oneLineProblem(oneLine: string): string | undefined {
  if (oneLine === "") return "A game needs one line about it.";
  if (oneLine.length > ONE_LINE_MAX) return "The one line can be up to 100 characters.";
  return undefined;
}

/**
 * Every field that is wrong, in the words a maker can act on, in the order a maker meets the boxes on the form's way
 * through the checks (name, line, repository, branch, folder). A field that is fine is not in the answer at all.
 */
export function gameFieldProblems(input: GameFieldsInput): GameFieldProblems {
  const { branch } = input.repo;
  const checked: [GameField, string | undefined][] = [
    ["name", nameProblem(input.name.trim())],
    ["oneLine", oneLineProblem(input.oneLine.trim())],
    [
      "repo",
      problemOf(() => {
        checkRepo(input.repo.fullName);
      }),
    ],
    [
      "branch",
      branch === null
        ? undefined
        : problemOf(() => {
            checkBranch(branch);
          }),
    ],
    [
      "folder",
      problemOf(() => {
        checkFolder(input.repo.folder);
      }),
    ],
  ];
  const problems: GameFieldProblems = {};
  for (const [field, words] of checked) {
    if (words !== undefined) problems[field] = words;
  }
  return problems;
}
