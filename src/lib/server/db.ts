import type { Handle } from "@sveltejs/kit/hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

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
 * Create one per process and call `$disconnect()` on shutdown.
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

/** Netlify runs each function in its own instance, so each instance keeps its pool small. */
const DEFAULT_POOL_MAX = 3;

let shared: PrismaClient | undefined;

/** The process-wide client, made on first use from `DATABASE_URL`. */
export function prisma(): PrismaClient {
  if (shared === undefined) {
    const url = process.env.DATABASE_URL;
    if (url === undefined || url === "") {
      throw new Error("Missing setting DATABASE_URL. Set it in Netlify's environment settings.");
    }
    shared = createPrismaClient(url, { poolMax: poolMaxFromEnv(process.env, DEFAULT_POOL_MAX) });
  }
  return shared;
}

/** Gives each request a database client of its own, opened when the request first uses it. */
export function databasePerRequest(open?: () => PrismaClient): Handle {
  throw new Error(`not built yet: ${typeof open}`);
}
