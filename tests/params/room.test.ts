import { describe, expect, it } from "vitest";
import { match } from "../../src/params/room.ts";

describe("the room address", () => {
  it.each(["address", "name", "about", "photo", "colours"])("matches %s", (word) => {
    expect(match(word)).toBe(true);
  });

  it.each(["links", "", "Name", "address/", "nope"])("does not match %j", (word) => {
    expect(match(word)).toBe(false);
  });
});
