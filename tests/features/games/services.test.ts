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
  GITHUB_APP_CLIENT_ID: "test-client",
  GITHUB_APP_CLIENT_SECRET: "test-only-client-secret",
  GITHUB_APP_SLUG: "ruken-test-app",
  BETTER_AUTH_SECRET: "test-only-secret-not-used-anywhere-real",
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

  it.each([
    "GITHUB_APP_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GAME_ADDRESS_PATTERN",
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_APP_SLUG",
    "BETTER_AUTH_SECRET",
  ])("stops with the name of %s when it is missing", (name) => {
    expect(() => build({ [name]: undefined })).toThrow(`Missing setting ${name}`);
  });

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

  it("refuses a GitHub web address that is not on this machine", () => {
    expect(() => build({ GITHUB_WEB_BASE: "https://evil.example" })).toThrow("GITHUB_WEB_BASE");
    expect(() => build({ GITHUB_WEB_BASE: "http://127.0.0.1.evil.example:80" })).toThrow("GITHUB_WEB_BASE");
    expect(() => build({ GITHUB_WEB_BASE: "http://127.0.0.1:12345" })).not.toThrow();
  });
});

describe("the connect addresses and state", () => {
  it("builds GitHub's two addresses from the app's settings", () => {
    const { connect } = build();
    expect(connect.signInUrl("abc")).toBe(
      "https://github.com/login/oauth/authorize?client_id=test-client&state=abc",
    );
    expect(connect.installUrl("abc")).toBe(
      "https://github.com/apps/ruken-test-app/installations/new?state=abc",
    );
  });

  it("points them at the stand-in when the web address is the stand-in's", () => {
    const { connect } = build({ GITHUB_WEB_BASE: "http://127.0.0.1:12345" });
    expect(connect.signInUrl("abc")).toBe(
      "http://127.0.0.1:12345/login/oauth/authorize?client_id=test-client&state=abc",
    );
  });

  // The state is sealed with the app's own secret and the clock, and opens only for the account that made it.
  it("seals a state with the clock, and opens it for the same account and no other", () => {
    const { connect } = build();
    const state = connect.sealState("user-1");
    expect(connect.openState(state, "user-1")).toBe(true);
    expect(connect.openState(state, "user-2")).toBe(false);
    expect(connect.openState(undefined, "user-1")).toBe(false);
  });
});
