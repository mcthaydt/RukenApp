import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import type { PrismaClient } from "../../src/lib/server/db.ts";
import { PrismaClient as NodePrismaClient } from "./generated/prisma/client.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PRISMA_BIN = fileURLToPath(new URL("../../node_modules/.bin/prisma", import.meta.url));

export interface TestDatabase {
  readonly url: string;
  readonly prisma: PrismaClient;
  stop(): Promise<void>;
}

/** Runs the real Prisma command line against `databaseUrl`, the way a deploy does. */
export function runPrisma(databaseUrl: string, args: readonly string[]): string {
  return execFileSync(PRISMA_BIN, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_DATABASE_URL: databaseUrl,
      PRISMA_HIDE_UPDATE_MESSAGE: "1",
    },
    encoding: "utf8",
  });
}

/**
 * A fresh, fully migrated database for one test file, on the server named by `TEST_DATABASE_URL`
 * (CI's Postgres service container). Each file gets its own database, so files do not see each
 * other's rows and can run side by side. `stop()` drops it.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const serverUrl = process.env.TEST_DATABASE_URL;
  if (serverUrl === undefined || serverUrl === "") {
    throw new Error("TEST_DATABASE_URL is not set. These tests run in CI's postgres job.");
  }
  const name = `ruken_test_${randomBytes(8).toString("hex")}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  try {
    // The name is made here from hex digits, so it is safe to put in the statement.
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  runPrisma(url.toString(), ["migrate", "deploy"]);
  // The app's client is generated for Workers and the tests run in Node, so they use the Node-generated one. The
  // two have the same shape and differ only in how they load WebAssembly, hence one cast.
  const prisma = new NodePrismaClient({
    adapter: new PrismaPg({ connectionString: url.toString(), max: 2 }),
  }) as unknown as PrismaClient;

  return {
    url: url.toString(),
    prisma,
    stop: async () => {
      await prisma.$disconnect();
      const dropper = new pg.Client({ connectionString: serverUrl });
      await dropper.connect();
      try {
        // FORCE ends any connection a test left open, so the drop cannot hang on one.
        await dropper.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      } finally {
        await dropper.end();
      }
    },
  };
}
