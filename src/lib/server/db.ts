import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Handle } from "@sveltejs/kit/hooks";
import { PrismaClient } from "./generated/prisma/client.ts";
import { platform } from "./platform.ts";

export { PrismaClient };
export * from "./generated/prisma/enums.ts";

export interface CreatePrismaClientOptions {
  /**
   * Largest number of connections this client's pool may open. Leave it out for pg's default (10).
   * Serverless hosts, where every function instance opens its own pool, should set a small number.
   */
  readonly poolMax?: number;
}

/** Prisma's driver adapter over a `pg` pool for this database. It opens its pool when asked to `connect()`. */
function pgAdapter(databaseUrl: string, options: CreatePrismaClientOptions): PrismaPg {
  const poolConfig =
    options.poolMax === undefined
      ? { connectionString: databaseUrl }
      : { connectionString: databaseUrl, max: options.poolMax };
  return new PrismaPg(poolConfig);
}

/**
 * A Prisma client that talks to Postgres through `pg` (the Prisma 7 driver adapter), with a pool of its own.
 * The site does not use this (`databasePerRequest` shares one client, see below); a test makes one for its own
 * database and calls `$disconnect()`.
 */
export function createPrismaClient(
  databaseUrl: string,
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  return new PrismaClient({ adapter: pgAdapter(databaseUrl, options) });
}

/**
 * The pool size from `DATABASE_POOL_MAX`, or `fallback` when it is unset. A bad value stops the
 * start with a message, because a silent fallback would hide a typo until the connections ran out.
 */
export function poolMaxFromEnv(
  source: Readonly<Record<string, string | undefined>>,
  fallback: number,
): number {
  const raw = source.DATABASE_POOL_MAX;
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`DATABASE_POOL_MAX must be a positive whole number, got "${raw}"`);
  }
  return value;
}

/** What one request holds: its own connection to the database, which Prisma's `pg` adapter hands out. */
export type RequestConnection = Awaited<ReturnType<PrismaPg["connect"]>>;

/** The calls Prisma's client makes of an adapter, answered by whichever connection the running request opened. */
export interface RequestScopedAdapter extends Pick<
  RequestConnection,
  "queryRaw" | "executeRaw" | "executeScript" | "startTransaction" | "getConnectionInfo" | "dispose"
> {
  readonly provider: "postgres";
  readonly adapterName: string;
}

/** What `new PrismaClient({ adapter })` takes. */
export interface RequestScopedAdapterFactory {
  readonly provider: "postgres";
  readonly adapterName: string;
  connect(): Promise<RequestScopedAdapter>;
}

/** Each request keeps its pool small: Hyperdrive pools the real connections in front of the database. */
const DEFAULT_POOL_MAX = 3;

const OUTSIDE_A_REQUEST = "The database is only reachable inside a request.";

// A Worker does not let one request use a database connection another request opened, so each request opens a
// connection of its own, kept here. The Prisma client is not per request: every client that starts leaves 1.4 to
// 2.8 MB behind in the Worker (`$disconnect()` does not give it back), which filled the Worker's memory and made
// workerd abort after about 1,000 requests; Cloudflare's limit is 128 MB. So one client serves every request, and
// its adapter hands each call to the connection of the request that made it.
interface RequestDatabase {
  readonly open: () => PrismaClient;
  client: PrismaClient | undefined;
  /** This request's connection, opened by its first query. */
  connection: Promise<RequestConnection> | undefined;
}

const requests = new AsyncLocalStorage<RequestDatabase>();

/**
 * An adapter for one Prisma client that serves every request. It holds no connection of its own: each call goes to
 * the connection the running request opened with `connect`, opened when that request first asks.
 *
 * Prisma gathers same-shaped `findUnique` calls made in one tick into one batch and runs it for the first caller.
 * That caller is still waiting for its answer, so its connection is alive, and the other callers only wait for the
 * result: no request touches a connection that has been closed.
 */
export function requestScopedAdapter(connect: () => Promise<RequestConnection>): RequestScopedAdapterFactory {
  const connectionOfRequest = (): Promise<RequestConnection> => {
    const request = requests.getStore();
    if (request === undefined) return Promise.reject(new Error(OUTSIDE_A_REQUEST));
    request.connection ??= connect();
    return request.connection;
  };
  const adapter: RequestScopedAdapter = {
    provider: "postgres",
    // The adapter this one stands for, which is the name Prisma expects for Postgres through `pg`.
    adapterName: "@prisma/adapter-pg",
    queryRaw: async (query) => (await connectionOfRequest()).queryRaw(query),
    executeRaw: async (query) => (await connectionOfRequest()).executeRaw(query),
    executeScript: async (script) => (await connectionOfRequest()).executeScript(script),
    startTransaction: async (isolationLevel) =>
      (await connectionOfRequest()).startTransaction(isolationLevel),
    // Asked before any query, so it cannot wait for a request's connection. These are the `pg` adapter's own answers.
    getConnectionInfo: () => ({ supportsRelationJoins: true }),
    // Nothing is held here to give back; Cloudflare closes each request's connections when the request ends.
    dispose: () => Promise.resolve(),
  };
  return {
    provider: adapter.provider,
    adapterName: adapter.adapterName,
    connect: () => Promise.resolve(adapter),
  };
}

// The one client the whole Worker uses, made when the first request needs it.
let workerClient: PrismaClient | undefined;

function sharedClient(): PrismaClient {
  workerClient ??= new PrismaClient({
    adapter: requestScopedAdapter(() =>
      pgAdapter(platform().databaseUrl(), {
        poolMax: poolMaxFromEnv(process.env, DEFAULT_POOL_MAX),
      }).connect(),
    ),
  });
  return workerClient;
}

/**
 * Lets each request reach the database through its own connection, opened when the request first uses the
 * database. Nothing is closed: Cloudflare closes a request's connections when the request ends. `open` makes the
 * client a request uses; the default is the Worker's one shared client.
 */
export function databasePerRequest(open: () => PrismaClient = sharedClient): Handle {
  return ({ event, resolve }) =>
    requests.run({ open, client: undefined, connection: undefined }, () => resolve(event));
}

function currentClient(): PrismaClient {
  const request = requests.getStore();
  if (request === undefined) throw new Error(OUTSIDE_A_REQUEST);
  request.client ??= request.open();
  return request.client;
}

// What `prisma()` answers. Reading a property reads it from the running request's client, so services built
// once per process can keep holding this one object and still reach the request they are serving.
const standIn = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = currentClient();
    const value: unknown = Reflect.get(client, property);
    // A method must run on the real client, not on this stand-in.
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

/** The database client of the request that is running. Outside a request, reading from it throws. */
export function prisma(): PrismaClient {
  return standIn;
}
