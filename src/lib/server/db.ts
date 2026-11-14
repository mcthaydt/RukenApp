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

/**
 * A Prisma client that talks to Postgres through `pg` (the Prisma 7 driver adapter).
 * `databasePerRequest` makes one per request; a test makes one for its own database and calls `$disconnect()`.
 */
export function createPrismaClient(
  databaseUrl: string,
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  const poolConfig =
    options.poolMax === undefined
      ? { connectionString: databaseUrl }
      : { connectionString: databaseUrl, max: options.poolMax };
  return new PrismaClient({ adapter: new PrismaPg(poolConfig) });
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

/** Each request keeps its pool small: Hyperdrive pools the real connections in front of the database. */
const DEFAULT_POOL_MAX = 3;

// A Worker does not let one request use a database connection another request opened, so a client made once
// per process would fail on the second request. Each request gets a client of its own instead, kept here.
interface RequestDatabase {
  readonly open: () => PrismaClient;
  client: PrismaClient | undefined;
}

const requests = new AsyncLocalStorage<RequestDatabase>();

/**
 * Gives each request a database client of its own, opened when the request first uses the database. Nothing
 * is closed: Cloudflare closes a request's connections when the request ends.
 */
export function databasePerRequest(
  open: () => PrismaClient = () =>
    createPrismaClient(platform().databaseUrl(), { poolMax: poolMaxFromEnv(process.env, DEFAULT_POOL_MAX) }),
): Handle {
  return ({ event, resolve }) => requests.run({ open, client: undefined }, () => resolve(event));
}

function currentClient(): PrismaClient {
  const request = requests.getStore();
  if (request === undefined) throw new Error("The database is only reachable inside a request.");
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
