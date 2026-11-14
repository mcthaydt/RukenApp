import { describe, expect, it } from "vitest";
import {
  MAKER_AGREEMENT_TEXT,
  MAKER_AGREEMENT_VERSION,
  parseAgreement,
} from "../../../src/features/make/make.ts";

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

// The page shows the file's own words as a numbered list, with the date the file carries (review F10).
describe("parseAgreement", () => {
  const body = "1. Your game stays yours. You let Ruken host it.\n2. It's yours to share. You made it.\n";

  it("reads the version and the date from the title line", () => {
    const read = parseAgreement(`Ruken maker agreement, version 2, 3 March 2027\n${body}`);
    expect(read.version).toBe("2");
    expect(read.updated).toBe("3 March 2027");
  });

  it("has no date when the title line carries none", () => {
    const read = parseAgreement(`Ruken maker agreement, version 1\n${body}`);
    expect(read.version).toBe("1");
    expect(read.updated).toBeNull();
  });

  it("splits each point into its number, its title and the point itself, in the file's words", () => {
    const read = parseAgreement(`Ruken maker agreement, version 1\n${body}`);
    expect(read.points).toEqual([
      { number: 1, title: "Your game stays yours.", body: "You let Ruken host it." },
      { number: 2, title: "It's yours to share.", body: "You made it." },
    ]);
  });

  it("reads Windows line ends and skips blank lines", () => {
    const read = parseAgreement("Ruken maker agreement, version 1\r\n\r\n1. Changes. We tell you.\r\n");
    expect(read.points).toEqual([{ number: 1, title: "Changes.", body: "We tell you." }]);
  });

  it("refuses a file that does not start with its title line", () => {
    expect(() => parseAgreement(`Something else\n${body}`)).toThrow(/title line/);
  });

  it("reads the real file: its version, and seven points numbered one to seven", () => {
    const read = parseAgreement(MAKER_AGREEMENT_TEXT);
    expect(read.version).toBe(MAKER_AGREEMENT_VERSION);
    expect(read.points.map((point) => point.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(read.points[0]).toMatchObject({ number: 1, title: "Your game stays yours." });
    expect(read.points[6]).toMatchObject({ number: 7, title: "Changes." });
  });
});
