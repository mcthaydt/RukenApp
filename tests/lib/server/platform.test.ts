import { describe, expect, it } from "vitest";
import { platform, setPlatform, type Platform } from "../../../src/lib/server/platform.ts";

describe("platform", () => {
  // The first case runs before any other sets a platform: the module holds one per process.
  it("says where it is set when nothing has set it", () => {
    expect(() => platform()).toThrow("No platform is set. src/hooks.server.ts sets it.");
  });

  it("answers what setPlatform was given", () => {
    const given: Platform = { databaseUrl: () => "postgres://stand-in", waitUntil: () => undefined };

    setPlatform(given);

    expect(platform()).toBe(given);
  });
});
