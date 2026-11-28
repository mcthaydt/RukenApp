import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The playtesting migration only adds (playtesting spec, "The migration only adds"): old code runs on the new schema,
// so rolling the site back is safe with the tables left in place.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261128082353_playtesting/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TYPE "Playtest(State|Via)" AS ENUM \(/,
  /^ALTER TYPE "PlayBasis" ADD VALUE 'playtest'$/,
  /^ALTER TABLE "Game" ADD COLUMN "playtestAsking" BOOLEAN NOT NULL DEFAULT false$/,
  /^CREATE TABLE "(Playtester|PlaytestLink)" \(/,
  /^CREATE (UNIQUE )?INDEX "(Playtester|PlaytestLink)_\w+" ON "(Playtester|PlaytestLink)"\(/,
  /^ALTER TABLE "(Playtester|PlaytestLink)" ADD CONSTRAINT "(Playtester|PlaytestLink)_\w+" /,
];

describe("the playtesting migration", () => {
  const statements = SQL.replace(/--.*$/gm, "")
    .split(";")
    .map((one) => one.trim().replace(/\s+/g, " "))
    .filter((one) => one !== "");

  it("has statements to check", () => {
    expect(statements.length).toBeGreaterThan(5);
  });

  it("only adds its own types, the one column, the enum value, and its tables, indexes and constraints", () => {
    expect(statements.filter((one) => !ADDING.some((kind) => kind.test(one)))).toEqual([]);
  });
});
