import { afterAll, describe, expect, it } from "vitest";
import { createGamesServices } from "../../../src/features/games/services.ts";
import { createPrismaClient } from "../../../src/lib/server/db.ts";
import { MemoryFileStore } from "../../support/memory-file-store.ts";
import { TestClock } from "../../support/test-clock.ts";

// The services are built from the settings. Nothing here connects: the database address is one that nothing
// listens on, and GitHub is never called.

const SETTINGS = {
  GITHUB_APP_ID: "42",
  GITHUB_APP_PRIVATE_KEY: "test-only-not-a-key",
  GAME_ADDRESS_PATTERN: "https://{name}.games.test",
};

const db = createPrismaClient("postgresql://postgres:x@127.0.0.1:1/ruken");

afterAll(async () => {
  await db.$disconnect();
});

function build(changes: Record<string, string | undefined> = {}) {
  return createGamesServices(
    { ...SETTINGS, ...changes },
    { db, clock: new TestClock("2026-11-14T12:00:00Z"), files: new MemoryFileStore() },
  );
}

describe("createGamesServices", () => {
  it("builds from the settings, and fills in a game's address", () => {
    expect(build().address("g-aaaaaaaaaa")).toBe("https://g-aaaaaaaaaa.games.test");
  });

  it.each(["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GAME_ADDRESS_PATTERN"])(
    "stops with the name of %s when it is missing",
    (name) => {
      expect(() => build({ [name]: undefined })).toThrow(`Missing setting ${name}`);
    },
  );

  it("refuses an address pattern that would put a game next to Ruken", () => {
    expect(() => build({ GAME_ADDRESS_PATTERN: "https://games.test" })).toThrow("GAME_ADDRESS_PATTERN");
  });

  // So that a real site cannot be pointed at a stand-in GitHub.
  it("refuses a GitHub address that is not on this machine", () => {
    expect(() => build({ GITHUB_API_BASE: "https://evil.example" })).toThrow("GITHUB_API_BASE");
    expect(() => build({ GITHUB_API_BASE: "http://127.0.0.1.evil.example:80" })).toThrow("GITHUB_API_BASE");
  });

  it("takes a stand-in GitHub on this machine", () => {
    expect(() => build({ GITHUB_API_BASE: "http://127.0.0.1:12345" })).not.toThrow();
  });
});
