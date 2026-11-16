import { describe, expect, it } from "vitest";
import { decisionWords } from "../../../src/features/admin/admin.ts";

// What the list says once after staff decide: so a person can tell Accept or Send back went through.

describe("decisionWords", () => {
  it.each([
    ["accepted_game", "Tiny game is live."],
    ["accepted_update", "The update to Tiny game is live."],
    ["sent_back", "Tiny game was sent back. Its maker can see why."],
    ["not_waiting", "Tiny game isn't waiting for a check any more."],
  ] as const)("%s says %s", (decision, words) => {
    expect(decisionWords(decision, "Tiny game")).toBe(words);
  });

  it("puts the game's name in as it is, whatever it holds", () => {
    expect(decisionWords("accepted_game", "{limit} & <b>")).toBe("{limit} & <b> is live.");
  });
});
