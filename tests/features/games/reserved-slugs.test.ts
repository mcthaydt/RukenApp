import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GAME_SLUG_SHAPE, RESERVED_GAME_SLUGS } from "../../../src/features/games/ids.ts";

// A game's page is /g/<slug>, but its maker's screens are /make/<slug>. A game named like one of the maker's own
// screens (`new`, `github`, `page`) would be hidden behind that screen, so those words are never given out.
const MAKE = join(import.meta.dirname, "../../../src/routes/make");

/** True when the folder, anywhere inside, holds a route (a +page or +server file). `parts` holds none. */
function holdsARoute(folder: string): boolean {
  return readdirSync(folder, { withFileTypes: true }).some((entry) =>
    entry.isDirectory() ? holdsARoute(join(folder, entry.name)) : /^\+(page|server)/.test(entry.name),
  );
}

describe("the addresses a game may not take", () => {
  it("lists every first-level folder of /make that is a route and could be a game's address", () => {
    const own = readdirSync(MAKE, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && holdsARoute(join(MAKE, entry.name)))
      .map((entry) => entry.name)
      .filter((name) => GAME_SLUG_SHAPE.test(name));
    expect(own.length).toBeGreaterThan(0);
    for (const name of own) expect(RESERVED_GAME_SLUGS.has(name), name).toBe(true);
  });

  it("keeps new, github and page", () => {
    expect([...RESERVED_GAME_SLUGS].sort()).toEqual(["github", "new", "page"]);
  });
});
