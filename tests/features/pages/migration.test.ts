import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The follows migration only adds (maker-credit-and-follow spec, "The migration only adds"): old code runs on the new
// schema, so rolling the site back is safe with the table left in place.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261127004623_maker_follows/migration.sql"),
  "utf8",
);

const ADDING = [
  /^CREATE TABLE "MakerFollow" \(/,
  /^CREATE (UNIQUE )?INDEX "MakerFollow_\w+" ON "MakerFollow"\(/,
  /^ALTER TABLE "MakerFollow" ADD CONSTRAINT "MakerFollow_\w+" /,
];

describe("the follows migration", () => {
  const statements = SQL.replace(/--.*$/gm, "")
    .split(";")
    .map((one) => one.trim().replace(/\s+/g, " "))
    .filter((one) => one !== "");

  it("has statements to check", () => {
    expect(statements.length).toBeGreaterThan(3);
  });

  it("only creates its own table, indexes and constraints", () => {
    expect(statements.filter((one) => !ADDING.some((kind) => kind.test(one)))).toEqual([]);
  });
});
