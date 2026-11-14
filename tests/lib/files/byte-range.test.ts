import { describe, expect, it } from "vitest";
import { matchesEtag, parseRange } from "../../../src/lib/files/byte-range.ts";

describe("parseRange", () => {
  it("asks for no range when there is no Range header", () => {
    expect(parseRange(null, 10)).toBe("none");
  });

  it.each([
    ["bytes=2-5", { offset: 2, length: 4 }],
    ["bytes=7-", { offset: 7, length: 3 }],
    ["bytes=-3", { offset: 7, length: 3 }],
    ["bytes=8-100", { offset: 8, length: 2 }],
    ["bytes=-100", { offset: 0, length: 10 }],
  ])("reads %s of a 10 byte file", (header, range) => {
    expect(parseRange(header, 10)).toEqual(range);
  });

  it.each(["bytes=0-1,4-5", "items=0-1"])("sends the whole file for %s", (header) => {
    expect(parseRange(header, 10)).toBe("none");
  });

  it.each(["bytes=10-20", "bytes=5-2", "bytes=-", "bytes=-0", "bytes=abc"])("cannot satisfy %s", (header) => {
    expect(parseRange(header, 10)).toBe("unsatisfiable");
  });
});

describe("matchesEtag", () => {
  it.each([
    ['"a"', true],
    ['W/"a"', true],
    ["*", true],
    ['"b", "a"', true],
    ['"b"', false],
    [null, false],
  ])('compares %j with the etag "a"', (header, matches) => {
    expect(matchesEtag(header, '"a"')).toBe(matches);
  });
});
