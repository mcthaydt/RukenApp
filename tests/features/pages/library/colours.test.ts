import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coloursOf, WADA_COLOURS } from "../../../../src/features/pages/themes.ts";
import { token } from "../../../support/look-tokens.ts";

// The colour data is a file copied in whole from a published package (design 5.3: "It is not a dependency").
// These tests hold it to what its source record says and to the shape the theme rule counts on.

const LIBRARY = new URL("../../../../src/features/pages/library/", import.meta.url);
const read = (name: string) => readFileSync(new URL(name, LIBRARY));
const source = JSON.parse(read("colours-source.json").toString("utf8")) as {
  package: string;
  version: string;
  sha256: string;
  bytes: number;
};

/** How many colours a combination holds, for each number from 1 to 348. */
const sizes = Array.from({ length: 348 }, (_, index) => coloursOf(index + 1).length);

describe("the book's colours", () => {
  it("holds the book's 159 colours", () => {
    expect(WADA_COLOURS).toHaveLength(159);
  });

  it("keeps a name, a hex and the combination numbers of each, and nothing else", () => {
    for (const colour of WADA_COLOURS)
      expect(Object.keys(colour).sort(), colour.name).toEqual(["combinations", "hex", "name"]);
  });

  it("writes every colour as # and six lower-case hex digits", () => {
    for (const colour of WADA_COLOURS) expect(colour.hex, colour.name).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("holds combinations 1 to 348, each of two, three or four colours", () => {
    sizes.forEach((size, index) => {
      expect([2, 3, 4], `combination ${String(index + 1)}`).toContain(size);
    });
    expect(coloursOf(349)).toEqual([]);
    expect(coloursOf(0)).toEqual([]);
  });

  it("has 120 combinations of two, 120 of three and 108 of four", () => {
    const count = (size: number) => sizes.filter((each) => each === size).length;
    expect([count(2), count(3), count(4)]).toEqual([120, 120, 108]);
  });

  it("gives a combination's colours in the data file's order", () => {
    const expected = WADA_COLOURS.filter((colour) => colour.combinations.includes(1)).map(
      (colour) => colour.hex,
    );
    expect(coloursOf(1)).toEqual(expected);
  });

  it("holds every colour the look names", () => {
    const hexes = new Set(WADA_COLOURS.map((colour) => colour.hex));
    for (const name of [
      "felt",
      "felt-deep",
      "felt-raised",
      "chalk",
      "sage",
      "paper",
      "ink",
      "ink-soft",
      "pip",
      "pay",
    ]) {
      expect(hexes.has(token(name)), `--${name}`).toBe(true);
    }
  });
});

describe("the data file's record", () => {
  it("is the file its source record names", () => {
    const file = read("colours.json");
    expect(source.package).toBe("dictionary-of-colour-combinations");
    expect(source.version).toBe("1.0.2");
    expect(file.length).toBe(source.bytes);
    expect(createHash("sha256").update(file).digest("hex")).toBe(source.sha256);
  });

  it("keeps the MIT licence beside the data", () => {
    const licence = read("colours-LICENSE.txt").toString("utf8");
    expect(licence).toContain("The MIT License");
    expect(licence).toContain("Matt DesLauriers");
  });
});
