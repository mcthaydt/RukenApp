import { describe, expect, it } from "vitest";
import { MAKER_AGREEMENT_TEXT, MAKER_AGREEMENT_VERSION } from "../../../src/features/make/make.ts";

// The text the Owner approved (2026-11-14), kept word for word in library/maker-agreement-v1.txt.

describe("the maker agreement", () => {
  it("is version 1, and the text says so", () => {
    expect(MAKER_AGREEMENT_VERSION).toBe("1");
    expect(MAKER_AGREEMENT_TEXT.startsWith("Ruken maker agreement, version 1\n")).toBe(true);
  });

  it("has seven numbered points and ends with one line break", () => {
    const points = MAKER_AGREEMENT_TEXT.split("\n").filter((line) => /^[1-9]\. /.test(line));
    expect(points.map((line) => line.slice(0, 2))).toEqual(["1.", "2.", "3.", "4.", "5.", "6.", "7."]);
    expect(MAKER_AGREEMENT_TEXT.endsWith(".\n")).toBe(true);
    expect(MAKER_AGREEMENT_TEXT.endsWith("\n\n")).toBe(false);
  });

  it("says the numbers the Owner set: half and half, 12 months, 3 hours a day, the 10th and the 15th, $25", () => {
    for (const words of [
      "Half of what's left goes to Ruken and half to makers.",
      "For a member's first 12 months",
      "up to 3 hours per game per day",
      "final on the 10th of each month and paid on the 15th",
      "at least $25",
    ]) {
      expect(MAKER_AGREEMENT_TEXT).toContain(words);
    }
  });
});
