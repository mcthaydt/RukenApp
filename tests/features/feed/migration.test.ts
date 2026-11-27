import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The marks migration only adds: old code runs on the new schema, so rolling the site back is safe with the table left
// in place. Every statement must be one of the adding kinds below.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261127004437_game_marks/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TYPE "MarkKind" AS ENUM \(/,
  /^CREATE TABLE "GameMark" \(/,
  /^CREATE (UNIQUE )?INDEX "GameMark_\w+" ON "GameMark"\(/,
  /^ALTER TABLE "GameMark" ADD CONSTRAINT "GameMark_\w+" /,
];

describe("the marks migration", () => {
  const statements = SQL.replace(/--.*$/gm, "")
    .split(";")
    .map((one) => one.trim().replace(/\s+/g, " "))
    .filter((one) => one !== "");

  it("has statements to check", () => {
    expect(statements.length).toBeGreaterThan(3);
  });

  it("only creates its own type, table, indexes and constraints", () => {
    expect(statements.filter((one) => !ADDING.some((kind) => kind.test(one)))).toEqual([]);
  });
});
