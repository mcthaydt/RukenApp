// DIAGNOSTIC ONLY, never merged. One request that does a chosen amount of database work, so a journey can tell
// which step leaves memory behind in the Worker.
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, createPrismaClient, prisma } from "../../../lib/server/db.ts";
import { platform } from "../../../lib/server/platform.ts";
import type { RequestHandler } from "./$types";

const SELECT_ONE = { sql: "SELECT 1", args: [], argTypes: [] };

type RequestAdapter = Awaited<ReturnType<PrismaPg["connect"]>>;
const perRequest = new AsyncLocalStorage<{ adapter?: Promise<RequestAdapter> }>();

/** The running request's own connection, opened on first use. */
function requestAdapter(): Promise<RequestAdapter> {
  const state = perRequest.getStore();
  if (state === undefined) throw new Error("outside a request");
  state.adapter ??= new PrismaPg({ connectionString: platform().databaseUrl(), max: 3 }).connect();
  return state.adapter;
}

// An adapter that holds no connection and hands every call to the running request's own one, so a single
// PrismaClient (and its query compiler) can serve every request.
const delegating = {
  provider: "postgres" as const,
  adapterName: "delegating",
  connect: () =>
    Promise.resolve({
      provider: "postgres" as const,
      adapterName: "delegating",
      queryRaw: async (query: typeof SELECT_ONE) => (await requestAdapter()).queryRaw(query),
      executeRaw: async (query: typeof SELECT_ONE) => (await requestAdapter()).executeRaw(query),
      executeScript: async (script: string) => (await requestAdapter()).executeScript(script),
      startTransaction: async (level?: Parameters<RequestAdapter["startTransaction"]>[0]) =>
        (await requestAdapter()).startTransaction(level),
      getConnectionInfo: () => ({ supportsRelationJoins: true }),
      dispose: () => Promise.resolve(),
    }),
};
let delegated: PrismaClient | undefined;

export const GET: RequestHandler = async ({ url }) => {
  const mode = url.searchParams.get("mode");
  if (mode === "client") {
    await prisma().$queryRaw`SELECT 1`;
  } else if (mode === "connect-only") {
    const client = createPrismaClient(platform().databaseUrl(), { poolMax: 3 });
    await client.$connect();
    await client.$disconnect();
  } else if (mode === "adapter-only") {
    const adapter = await new PrismaPg({ connectionString: platform().databaseUrl(), max: 3 }).connect();
    await adapter.queryRaw(SELECT_ONE);
    await adapter.dispose();
  } else if (mode === "delegating") {
    // @ts-expect-error the stand-in adapter is checked by running it, not by its types
    delegated ??= new PrismaClient({ adapter: delegating });
    const client = delegated;
    await perRequest.run({}, () => client.$queryRaw`SELECT 1`);
  }
  return Response.json({ mode });
};
