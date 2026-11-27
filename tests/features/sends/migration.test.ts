import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The Your turn migration only adds (games-sent-to-you brief, "The migration only adds"): old code runs on the new
// schema, so rolling the site back is safe with the tables left in place.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261127131242_game_sends/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TABLE "(GameSend|SendStop)" \(/,
  /^CREATE (UNIQUE )?INDEX "(GameSend|SendStop)_\w+" ON "(GameSend|SendStop)"\(/,
  /^ALTER TABLE "(GameSend|SendStop)" ADD CONSTRAINT "(GameSend|SendStop)_\w+" /,
];

describe("the Your turn migration", () => {
  const statements = SQL.replace(/--.*$/gm, "")
    .split(";")
    .map((one) => one.trim().replace(/\s+/g, " "))
    .filter((one) => one !== "");

  it("has statements to check", () => {
    expect(statements.length).toBeGreaterThan(3);
  });

  it("only creates its own tables, indexes and constraints", () => {
    expect(statements.filter((one) => !ADDING.some((kind) => kind.test(one)))).toEqual([]);
  });
});
