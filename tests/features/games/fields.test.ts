import { describe, expect, it } from "vitest";
import {
  ageProblem,
  branchProblem,
  folderProblem,
  marksProblem,
  nameProblem,
  oneLineProblem,
  playsOnProblem,
  repoProblem,
} from "../../../src/features/games/fields.ts";

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
    expect(repoProblem("")).toBe("Pick your game from the list.");
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
