import { describe, expect, it } from "vitest";
import { checkAddressPattern, gameAddress } from "../../../src/features/games/addresses.ts";

describe("gameAddress", () => {
  it("fills in the game's name", () => {
    expect(gameAddress("https://{name}.games.test", "g-aaaaaaaaaa")).toBe("https://g-aaaaaaaaaa.games.test");
    expect(gameAddress("http://{name}.localhost:8788", "g-aaaaaaaaaa")).toBe(
      "http://g-aaaaaaaaaa.localhost:8788",
    );
  });

  // The path form: one free address, with the game as the first part of the path.
  it("fills in the path form", () => {
    expect(gameAddress("https://games.example.com/{name}", "g-abc")).toBe("https://games.example.com/g-abc");
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

// Until the games' domain exists, every game lives on one free address, with its name as the whole of the one path part.
describe("checkAddressPattern, the path form", () => {
  it.each([
    "https://ruken-games.example.workers.dev/{name}",
    "https://games.example.com:8443/{name}",
    "http://localhost:8788/{name}",
  ])("accepts %s", (pattern) => {
    expect(() => {
      checkAddressPattern(pattern);
    }).not.toThrow();
  });

  it.each([
    "https://games.example.com/{name}/more",
    "https://games.example.com/a/{name}",
    "https://{name}.example.com/{name}",
    "http://games.example.com/{name}",
    "https://games.example.com/{name}?a=1",
    "https://games.example.com/",
  ])("refuses %s", (pattern) => {
    expect(() => {
      checkAddressPattern(pattern);
    }).toThrow("GAME_ADDRESS_PATTERN");
  });

  it("names both forms in its refusal", () => {
    expect(() => {
      checkAddressPattern("nonsense");
    }).toThrow("https://games.example.com/{name}");
  });
});
