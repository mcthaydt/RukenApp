import { prisma } from "../../lib/server/db.ts";
import type { RequestHandler } from "./$types";

// The first proof that a built Worker reaches its database: one query, and the answer says which half failed.
// It names no setting and no error, so anyone who asks learns nothing about the site.
export const GET: RequestHandler = async () => {
  try {
    await prisma().$queryRaw`SELECT 1`;
  } catch {
    return new Response("database", { status: 503 });
  }
  return new Response("ok");
};
