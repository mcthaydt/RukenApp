import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The reports migration only adds (report-a-game spec, "The migration only adds"): old code runs on the new schema, so
// rolling the site back is safe with the table left in place. Every statement must be one of the adding kinds below.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261124013000_game_reports/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TYPE "ReportReason" AS ENUM \(/,
  /^CREATE TABLE "GameReport" \(/,
  /^CREATE (UNIQUE )?INDEX "GameReport_\w+" ON "GameReport"\(/,
  /^ALTER TABLE "GameReport" ADD CONSTRAINT "GameReport_\w+" /,
];

describe("the reports migration", () => {
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
