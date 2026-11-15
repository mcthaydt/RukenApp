import { describe, expect, it } from "vitest";
import {
  ageProblem,
  branchProblem,
  folderProblem,
  gameFieldProblems,
  marksProblem,
  nameProblem,
  oneLineProblem,
  playsOnProblem,
  repoProblem,
} from "../../../src/features/games/fields.ts";

// Every refusal of the new-game form at once, so a maker fixes the whole form in one go (review F6).

const fine = {
  name: "Floor Fifty",
  oneLine: "Climb. Fall. Climb again.",
  repo: { fullName: "acme/floor-fifty", branch: null, folder: "" },
};

describe("gameFieldProblems", () => {
  it("has nothing to say about a form that is fine", () => {
    expect(gameFieldProblems(fine)).toEqual({});
    expect(
      gameFieldProblems({
        ...fine,
        repo: { fullName: "acme/floor-fifty", branch: "main", folder: "web/build" },
      }),
    ).toEqual({});
  });

  it("says every empty field, each in its own words", () => {
    expect(
      gameFieldProblems({ name: "  ", oneLine: "", repo: { fullName: "", branch: null, folder: "" } }),
    ).toEqual({
      name: "A game needs a name.",
      oneLine: "A game needs one line about it.",
      repo: "Choose the repository your game is in.",
    });
  });

  it("says a name that is too short and a missing line together", () => {
    expect(gameFieldProblems({ ...fine, name: "!!", oneLine: "" })).toEqual({
      name: "Pick a name with at least three letters or numbers.",
      oneLine: "A game needs one line about it.",
    });
  });

  it("says a name or a line that is too long", () => {
    expect(gameFieldProblems({ ...fine, name: "a".repeat(61), oneLine: "b".repeat(101) })).toEqual({
      name: "A game's name can be up to 60 characters.",
      oneLine: "The one line can be up to 100 characters.",
    });
  });

  it("says a repository, a branch and a folder that cannot be right", () => {
    expect(
      gameFieldProblems({ ...fine, repo: { fullName: "no-slash", branch: "a b", folder: "/web" } }),
    ).toEqual({
      repo: "That doesn't look like a GitHub repository. It should read owner/name.",
      branch: "That doesn't look like a branch name.",
      folder: "That doesn't look like a folder. Write it like web/build, with no slash at the start or end.",
    });
  });
});

// One checker for each answer, so a screen that asks one question at a time says only that question's refusal.
describe("one checker for each answer", () => {
  it("name", () => {
    expect(nameProblem("Floor Fifty")).toBeUndefined();
    expect(nameProblem("")).toBe("A game needs a name.");
    expect(nameProblem("ab")).toBe("Pick a name with at least three letters or numbers.");
    expect(nameProblem("a".repeat(61))).toBe("A game's name can be up to 60 characters.");
  });

  it("one line", () => {
    expect(oneLineProblem("Climb.")).toBeUndefined();
    expect(oneLineProblem("")).toBe("A game needs one line about it.");
    expect(oneLineProblem("b".repeat(101))).toBe("The one line can be up to 100 characters.");
  });

  it("repository, branch and folder", () => {
    expect(repoProblem("acme/game")).toBeUndefined();
    expect(repoProblem("")).toBe("Choose the repository your game is in.");
    expect(branchProblem("main")).toBeUndefined();
    expect(branchProblem("a b")).toBe("That doesn't look like a branch name.");
    expect(folderProblem("web/build")).toBeUndefined();
    expect(folderProblem("/web")).toMatch(/^That doesn't look like a folder/);
  });

  it("where it plays", () => {
    expect(playsOnProblem("computer_only")).toBeUndefined();
    expect(playsOnProblem(null)).toBe("Choose where your game plays.");
  });

  it("who it is for", () => {
    expect(ageProblem("age_12")).toBeUndefined();
    expect(ageProblem(null)).toBe("Choose who your game is for.");
  });

  it("what it has", () => {
    expect(marksProblem(["gore"])).toBeUndefined();
    expect(marksProblem(["none"])).toBeUndefined();
    expect(marksProblem([])).toBe("Choose at least one, or None of these.");
  });
});
