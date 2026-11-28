import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The owner said yes to deleting the old stops (drop-send-stops brief): the migration drops that one table, and
// nothing else, so no other row can go with it.

const SQL = readFileSync(
  join(import.meta.dirname, "../../../prisma/migrations/20261128145318_drop_send_stops/migration.sql"),
  "utf8",
);

describe("the migration that drops the old stops", () => {
  it("is one statement: dropping SendStop", () => {
    const statements = SQL.replace(/--.*$/gm, "")
      .split(";")
      .map((one) => one.trim().replace(/\s+/g, " "))
      .filter((one) => one !== "");
    expect(statements).toEqual(['DROP TABLE "SendStop"']);
  });
});
