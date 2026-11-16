import { describe, expect, it } from "vitest";
import { tickProblem } from "../../../src/features/admin/admin.ts";

// The page's own title for each part, as the check page shows it.
const TITLES: Record<string, string> = {
  name: "Name",
  one_line: "One line",
  files: "Game files",
  wide_video: "Wide video",
};
const titleOf = (part: string) => TITLES[part] ?? part;

// A refusal about a ticked part names the part, so staff on a long page do not hunt for the one they ticked (walk W4).

describe("tickProblem", () => {
  it("is nothing for no part", () => {
    expect(tickProblem([], titleOf)).toBeNull();
  });

  it("is nothing when every part has one of its own reasons", () => {
    expect(
      tickProblem([{ part: "one_line", reason: "something_else", note: "Say what the game is." }], titleOf),
    ).toBeNull();
  });

  it("names a part with no reason", () => {
    expect(tickProblem([{ part: "one_line", reason: "", note: "" }], titleOf)).toEqual({
      part: "one_line",
      words: "Pick a reason for One line.",
    });
  });

  it("names a part whose reason belongs to another part", () => {
    expect(tickProblem([{ part: "files", reason: "rude", note: "" }], titleOf)).toEqual({
      part: "files",
      words: "Pick a reason for Game files.",
    });
  });

  it("names a Something else with no line, or only spaces", () => {
    expect(tickProblem([{ part: "wide_video", reason: "something_else", note: "   " }], titleOf)).toEqual({
      part: "wide_video",
      words: "Say what's wrong with Wide video, in your own words.",
    });
  });

  it("says the first part that cannot be sent back, in the order they were ticked", () => {
    expect(
      tickProblem(
        [
          { part: "name", reason: "something_else", note: "It's rude." },
          { part: "files", reason: "", note: "" },
          { part: "plays_on", reason: "something_else", note: "" },
        ],
        titleOf,
      ),
    ).toEqual({ part: "files", words: "Pick a reason for Game files." });
  });
});
