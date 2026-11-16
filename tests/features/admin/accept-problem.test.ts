import { describe, expect, it } from "vitest";
import { acceptProblem } from "../../../src/features/admin/admin.ts";

// Staff are refused for who a game is for before they are asked "Accept it anyway?", so they never say yes to a question
// and are then refused for something that was wrong before they were asked (harsh look HL4).

describe("acceptProblem", () => {
  it("is nothing for an age below 18+, whatever marks were posted", () => {
    expect(acceptProblem({ ageRating: "age_12", marks: [] }, "Tiny game")).toBeNull();
    expect(acceptProblem({ ageRating: "age_16", marks: ["gore"] }, "Tiny game")).toBeNull();
  });

  it("asks for an age when none was picked", () => {
    expect(acceptProblem({ ageRating: "", marks: [] }, "Tiny game")).toEqual({
      part: "age_rating",
      atMarks: false,
      words: "Pick who this game is for.",
    });
  });

  it("asks for a mark on an 18+ game with none, naming the game", () => {
    expect(acceptProblem({ ageRating: "age_18", marks: [] }, "Tiny game")).toEqual({
      part: "age_rating",
      atMarks: true,
      words: "Pick what Tiny game has, or None of these.",
    });
  });

  it("does not count a mark the page never offers", () => {
    expect(acceptProblem({ ageRating: "age_18", marks: ["bogus"] }, "Tiny game")?.atMarks).toBe(true);
  });

  it("asks for None of these on its own", () => {
    expect(acceptProblem({ ageRating: "age_18", marks: ["none", "gore"] }, "Tiny game")).toEqual({
      part: "age_rating",
      atMarks: true,
      words: "Pick None of these on its own, or pick what's in it.",
    });
  });

  it("is nothing for an 18+ game with a mark, or with None of these alone", () => {
    expect(acceptProblem({ ageRating: "age_18", marks: ["gore", "drugs"] }, "Tiny game")).toBeNull();
    expect(acceptProblem({ ageRating: "age_18", marks: ["none"] }, "Tiny game")).toBeNull();
  });
});
