import { describe, expect, it } from "vitest";
import { checkAddressPattern, gameAddress } from "../../../src/features/games/addresses.ts";

describe("gameAddress", () => {
  it("fills in the game's name", () => {
    expect(gameAddress("https://{name}.games.test", "g-aaaaaaaaaa")).toBe("https://g-aaaaaaaaaa.games.test");
    expect(gameAddress("http://{name}.localhost:8788", "g-aaaaaaaaaa")).toBe(
      "http://g-aaaaaaaaaa.localhost:8788",
    );
  });
});

describe("checkAddressPattern", () => {
  it.each(["https://{name}.games.test", "http://{name}.localhost:8788", "http://{name}.localhost"])(
    "accepts %s",
    (pattern) => {
      expect(() => {
        checkAddressPattern(pattern);
      }).not.toThrow();
    },
  );

  // A game must never share an address with Ruken or with another game, and a plain-http one is only for a
  // developer's own machine.
  it.each([
    ["http on a real name", "http://{name}.games.test"],
    ["no {name}", "https://games.test"],
    ["a path", "https://{name}.games.test/x"],
    ["a trailing slash", "https://{name}.games.test/"],
    ["{name} not first", "https://x.{name}.games.test"],
    ["{name} part of a label", "https://g-{name}.games.test"],
    ["{name} twice", "https://{name}.{name}.games.test"],
    ["a query", "https://{name}.games.test?x=1"],
    ["no scheme", "{name}.games.test"],
    ["another scheme", "ftp://{name}.games.test"],
    ["empty", ""],
  ])("refuses %s", (_why, pattern) => {
    expect(() => {
      checkAddressPattern(pattern);
    }).toThrow("GAME_ADDRESS_PATTERN");
  });
});
