import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "../../src/lib/server/db.ts";
import { PrismaClient as NodePrismaClient } from "./generated/prisma/client.ts";

/**
 * The statements `run` sends to the database at `url`, in order. On the site each request holds one connection, so
 * statements wait for each other however they are asked: their number is the page's wait, and a test can hold it.
 */
export async function queriesAsked(
  url: string,
  run: (db: PrismaClient) => Promise<unknown>,
): Promise<string[]> {
  const counting = new NodePrismaClient({
    adapter: new PrismaPg({ connectionString: url, max: 1 }),
    log: [{ emit: "event", level: "query" }],
  });
  const asked: string[] = [];
  counting.$on("query", (event) => asked.push(event.query));
  try {
    await counting.$connect();
    // The same cast as tests/support/database.ts: the Node-made client has the app's shape.
    await run(counting as unknown as PrismaClient);
  } finally {
    await counting.$disconnect();
  }
  return asked;
}
