import { describe, expect, it } from "vitest";
import { newPublicId, PUBLIC_ID, slugOf } from "../../../src/features/games/ids.ts";

describe("slugOf", () => {
  it.each([
    ["Floor Fifty", "floor-fifty"],
    ["  Büro: 2000!  ", "buro-2000"],
    ["A--B__c", "a-b-c"],
  ])("turns %j into %j", (name, slug) => {
    expect(slugOf(name)).toBe(slug);
  });

  it("cuts a long name at 40 characters, never ending in a hyphen", () => {
    expect(slugOf("a".repeat(39) + " b c")).toBe("a".repeat(39));
  });

  it.each(["", "!!", "ab"])("has no address for %j", (name) => {
    expect(slugOf(name)).toBeNull();
  });
});

describe("newPublicId", () => {
  it("makes a public id of ten characters, a-z and 2-7", () => {
    expect(newPublicId()).toMatch(PUBLIC_ID);
  });

  it("uses the bytes it is given", () => {
    expect(newPublicId(() => new Uint8Array(10))).toBe("aaaaaaaaaa");
  });
});
