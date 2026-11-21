import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESERVED_GAME_SLUGS } from "../../../src/features/games/reserved.ts";

const MAKE = join(import.meta.dirname, "..", "..", "..", "src", "routes", "make");
const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** True when a route file (a page or an endpoint) is anywhere inside the folder. */
function holdsARoute(folder: string): boolean {
  return readdirSync(folder, { withFileTypes: true }).some((entry) =>
    entry.isDirectory() ? holdsARoute(join(folder, entry.name)) : /^\+(page|server)\b/.test(entry.name),
  );
}

describe("the words a game's address may not be", () => {
  // A folder of `/make/` with a fixed name beats `/make/[game]`, so a game with that address could not be opened.
  it("lists every first-level folder of src/routes/make/ that holds a route and could be a game's address", () => {
    const shadowing = readdirSync(MAKE, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && SLUG_SHAPE.test(entry.name))
      .filter((entry) => holdsARoute(join(MAKE, entry.name)))
      .map((entry) => entry.name);
    expect(shadowing.length).toBeGreaterThan(0);
    for (const word of shadowing) expect(RESERVED_GAME_SLUGS.has(word), word).toBe(true);
  });

  it("holds the three words today", () => {
    expect([...RESERVED_GAME_SLUGS].sort()).toEqual(["github", "new", "page"]);
  });
});
