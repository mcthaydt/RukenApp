// DIAGNOSTIC ONLY, never merged. One request that does a chosen amount of database work, and says how big the
// Worker's JavaScript heap is afterwards, so a journey can tell which step leaks.
import pg from "pg";
import { createPrismaClient, prisma } from "../../../lib/server/db.ts";
import { platform } from "../../../lib/server/platform.ts";
import type { RequestHandler } from "./$types";

// One client for the whole isolate, to see whether the cost is in making a client or in each query.
let shared: ReturnType<typeof createPrismaClient> | undefined;

export const GET: RequestHandler = async ({ url }) => {
  const mode = url.searchParams.get("mode");
  if (mode === "client") {
    await prisma().$queryRaw`SELECT 1`;
  } else if (mode === "client-disconnect") {
    await prisma().$queryRaw`SELECT 1`;
    await prisma().$disconnect();
  } else if (mode === "pg-end") {
    const pool = new pg.Pool({ connectionString: platform().databaseUrl(), max: 3 });
    await pool.query("SELECT 1");
    await pool.end();
  } else if (mode === "pg-noend") {
    const pool = new pg.Pool({ connectionString: platform().databaseUrl(), max: 3 });
    await pool.query("SELECT 1");
  } else if (mode === "shared") {
    shared ??= createPrismaClient(platform().databaseUrl(), { poolMax: 3 });
    try {
      await shared.$queryRaw`SELECT 1`;
    } catch {
      /* a connection another request opened may be refused; what matters is the memory */
    }
  } else if (mode === "new-only") {
    createPrismaClient(platform().databaseUrl(), { poolMax: 3 });
  } else if (mode === "new-disconnect") {
    await createPrismaClient(platform().databaseUrl(), { poolMax: 3 }).$disconnect();
  }
  let heapUsed = -1;
  try {
    heapUsed = process.memoryUsage().heapUsed;
  } catch {
    /* this runtime has no memoryUsage */
  }
  return Response.json({ mode, heapUsed });
};
