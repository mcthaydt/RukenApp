import { describe, expect, it } from "vitest";
import { readReviewOrder } from "../../../src/features/games/review-order.ts";

// What the Owner's review command says, read from a body that arrives from outside and is never believed.

const WHAT_TO_DO = 'Say what to do: "do" is "list", "look", "accept" or "send-back".';
const WHICH_GAME = 'Say which game: "game" is its address from the list.';
const WHAT_IS_WRONG =
  'Say what\'s wrong: "parts" is a list like [{ "part": "files", "words": "It doesn\'t start." }].';

describe("readReviewOrder", () => {
  it.each([
    [{ do: "list" }, { do: "list" }],
    [
      { do: "look", game: "tiny-game" },
      { do: "look", game: "tiny-game" },
    ],
    [
      { do: "accept", game: "tiny-game" },
      { do: "accept", game: "tiny-game" },
    ],
    [
      { do: "send-back", game: "tiny-game", parts: [{ part: "files", words: "It doesn't start." }] },
      { do: "send-back", game: "tiny-game", parts: [{ part: "files", words: "It doesn't start." }] },
    ],
  ])("reads %j", (body, order) => {
    expect(readReviewOrder(body)).toEqual(order);
  });

  it.each([null, "list", {}, { do: "delete" }, { do: 7 }])("asks what to do for %j", (body) => {
    expect(readReviewOrder(body)).toEqual({ problem: WHAT_TO_DO });
  });

  it.each([{ do: "look" }, { do: "accept", game: "" }, { do: "send-back", game: 7 }])(
    "asks which game for %j",
    (body) => {
      expect(readReviewOrder(body)).toEqual({ problem: WHICH_GAME });
    },
  );

  it.each([[undefined], [[]], [[{ part: "files" }]], [[{ part: "files", words: 3 }]], ["files"], [[7]]])(
    "asks what's wrong for parts %j",
    (parts) => {
      expect(readReviewOrder({ do: "send-back", game: "tiny-game", parts })).toEqual({
        problem: WHAT_IS_WRONG,
      });
    },
  );

  it("names the parts when one is not a part", () => {
    expect(
      readReviewOrder({ do: "send-back", game: "tiny-game", parts: [{ part: "music", words: "x" }] }),
    ).toEqual({
      problem:
        "That part isn't one of: name, one_line, files, upright_video, wide_video, age_rating, other_websites.",
    });
  });

  it("refuses plays_on: no game is asked where it plays any more", () => {
    expect(
      readReviewOrder({ do: "send-back", game: "tiny-game", parts: [{ part: "plays_on", words: "x" }] }),
    ).toEqual({
      problem:
        "That part isn't one of: name, one_line, files, upright_video, wide_video, age_rating, other_websites.",
    });
  });

  it("does not judge the words themselves: the service does, in its own words", () => {
    expect(
      readReviewOrder({ do: "send-back", game: "tiny-game", parts: [{ part: "files", words: "" }] }),
    ).toEqual({ do: "send-back", game: "tiny-game", parts: [{ part: "files", words: "" }] });
  });
});
