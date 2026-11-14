import { readdirSync } from "node:fs";
import { extname, join, parse } from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanHandle,
  handleProblem,
  isHandleShape,
  RESERVED_HANDLES,
} from "../../../src/features/pages/handle.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");

/**
 * The first-level folders of src/routes (a name that starts with "[" or "+" is a route's own file or a
 * parameter, not a word in an address) and every first-level name in static/, each with and without its extension.
 */
function routeAndStaticNames(): string[] {
  const routes = readdirSync(join(ROOT, "src", "routes"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("[") && !name.startsWith("+"));
  const statics = readdirSync(join(ROOT, "static")).flatMap((name) =>
    extname(name) === "" ? [name] : [name, parse(name).name],
  );
  return [...routes, ...statics];
}

describe("a maker's address", () => {
  it.each([
    ["  @Maker  ", "maker"],
    ["Night-Owl", "night-owl"],
  ])("cleans %j to %j", (raw, clean) => {
    expect(cleanHandle(raw)).toBe(clean);
  });

  it.each([
    ["ab", "Use at least 3 letters or numbers."],
    ["a".repeat(31), "That's too long. Use 30 characters or fewer."],
    ["night owl", "Use only letters, numbers and hyphens."],
    ["night--owl", "Use only letters, numbers and hyphens."],
    ["-owl", "Use only letters, numbers and hyphens."],
    ["büro", "Use only letters, numbers and hyphens."],
    ["me", "Use at least 3 letters or numbers."],
    ["make", "That one is taken. Pick another."],
    ["Admin", "That one is taken. Pick another."],
  ])("refuses %j: %s", (raw, words) => {
    expect(handleProblem(raw)).toBe(words);
  });

  it.each(["maker", "night-owl", "a1b", "a".repeat(30)])("takes %j", (raw) => {
    expect(handleProblem(raw)).toBeNull();
  });

  it("says a reserved word has the right shape, so it still reaches its own route", () => {
    expect(isHandleShape("make")).toBe(true);
    expect(isHandleShape("ab")).toBe(false);
    expect(isHandleShape("Maker")).toBe(false);
  });

  it("keeps every address Ruken itself uses", () => {
    // Review Focus 3. `g` and `me` are too short to be anyone's, so only names with a handle's shape count.
    for (const name of routeAndStaticNames()) {
      if (isHandleShape(name)) expect(RESERVED_HANDLES.has(name), name).toBe(true);
    }
  });
});
