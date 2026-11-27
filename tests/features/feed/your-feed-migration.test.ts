import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Your feed's migration only adds (two tables, their types and two User columns with defaults), so the site can be
// rolled back with them left in place: old code never reads them.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261127004603_your_feed/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TYPE "(TasteDirection|TasteKind|GoodPickAnswer)" AS ENUM \(/,
  /^CREATE TABLE "(FeedTaste|GoodPickAsked)" \(/,
  /^CREATE (UNIQUE )?INDEX "(FeedTaste|GoodPickAsked)_\w+" ON "(FeedTaste|GoodPickAsked)"\(/,
  /^ALTER TABLE "(FeedTaste|GoodPickAsked)" ADD CONSTRAINT "(FeedTaste|GoodPickAsked)_\w+" /,
  /^ALTER TABLE "User" ADD COLUMN "feedPersonal" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "feedResetAt" TIMESTAMPTZ$/,
];

describe("the Your feed migration", () => {
  const statements = SQL.replace(/--.*$/gm, "")
    .split(";")
    .map((one) => one.trim().replace(/\s+/g, " "))
    .filter((one) => one !== "");

  it("has statements to check", () => {
    expect(statements.length).toBeGreaterThan(5);
  });

  it("only creates its own types, tables, indexes and constraints, and two User columns with defaults", () => {
    expect(statements.filter((one) => !ADDING.some((kind) => kind.test(one)))).toEqual([]);
  });
});
