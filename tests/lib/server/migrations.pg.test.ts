import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runPrisma, startTestDatabase, type TestDatabase } from "../../support/database.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.stop();
});

/** Every table in schema public. */
async function tableNames(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  return rows.map((row) => row.table_name);
}

/**
 * Asks Prisma what differs between the migrated database and prisma/schema. `--exit-code` makes it
 * exit 0 for no difference and 2 for a difference; any other failure is thrown as it is.
 */
function schemaDriftExitCode(databaseUrl: string): number {
  try {
    runPrisma(databaseUrl, [
      "migrate",
      "diff",
      "--from-config-datasource",
      "--to-schema",
      "prisma/schema",
      "--exit-code",
    ]);
    return 0;
  } catch (error) {
    const status = (error as { status?: unknown }).status;
    if (status === 2) return 2;
    throw error;
  }
}

describe("migrations on a clean Postgres 16", () => {
  it("make the accounts tables", async () => {
    const tables = await tableNames(database.prisma);
    expect(tables).toEqual(
      expect.arrayContaining([
        "User",
        "Session",
        "Account",
        "Verification",
        "StaffAssignment",
        "RateLimit",
        "SignInGuard",
        "DeletionRequest",
      ]),
    );
  });

  it("match the schema, so the generated client and the database agree", () => {
    expect(schemaDriftExitCode(database.url)).toBe(0);
  });

  it("refuse a SignInGuard row whose emailHash is not 64 lower-case hex characters", async () => {
    await expect(
      database.prisma
        .$executeRaw`INSERT INTO "SignInGuard" ("emailHash", failures, "windowStartedAt", "updatedAt")
      VALUES ('nope', 1, now(), now())`,
    ).rejects.toThrow();
  });
});
