import { systemClock, type Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import { prisma, type PrismaClient } from "../../lib/server/db.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { fileStore } from "../../lib/server/files.ts";
import { checkAddressPattern, gameAddress } from "./addresses.ts";
import type { Connection } from "./github-connect.ts";
import { createGitHub } from "./github.ts";
import { createGamesService, type GamesService } from "./service.ts";

// Everything the games feature needs, built once per server process from the settings. Routes call
// gamesServices(); tests build their own with createGamesServices.

type Settings = Readonly<Record<string, string | undefined>>;

/** What the connect screens need, with the app's settings and the clock already in it (stub). */
export interface GitHubConnect {
  signInUrl(state: string): string;
  installUrl(state: string): string;
  connectionOf(code: string): Promise<Connection[]>;
  sealState(userId: string): string;
  openState(value: string | undefined, userId: string): boolean;
}

export interface GamesServices {
  service: GamesService;
  connect: GitHubConnect;
  /** The address a game is played at, from its public id (`g-<id>`). */
  address(name: string): string;
}

/** The only place GitHub's address may be changed: a stand-in server on this machine, for the journeys. */
const STAND_IN_GITHUB = "http://127.0.0.1:";

/**
 * Reads the settings first, so a missing one stops the start with its name before anything is connected. `parts` are
 * what the games borrow from the site: the database, the clock and the bucket.
 */
export function createGamesServices(
  source: Settings,
  parts: { db: PrismaClient; clock: Clock; files: FileStore },
): GamesServices {
  const appId = requireEnv("GITHUB_APP_ID", source);
  const privateKeyPem = requireEnv("GITHUB_APP_PRIVATE_KEY", source);
  const pattern = requireEnv("GAME_ADDRESS_PATTERN", source);
  checkAddressPattern(pattern);
  // Refused at start, so a real site can never be pointed at a stand-in that answers with whatever it likes.
  const apiBase = optionalEnv("GITHUB_API_BASE", source);
  if (apiBase !== undefined && !apiBase.startsWith(STAND_IN_GITHUB)) {
    throw new Error(
      `GITHUB_API_BASE is for a stand-in on this machine only: it must start with ${STAND_IN_GITHUB}`,
    );
  }

  const github = createGitHub({
    appId,
    privateKeyPem,
    clock: parts.clock,
    ...(apiBase === undefined ? {} : { apiBase }),
  });
  const service = createGamesService({ db: parts.db, clock: parts.clock, files: parts.files, github });
  const connect: GitHubConnect = {
    signInUrl: (state) => {
      throw new Error(`not built yet: connect.signInUrl ${state}`);
    },
    installUrl: (state) => {
      throw new Error(`not built yet: connect.installUrl ${state}`);
    },
    connectionOf: (code) => Promise.reject(new Error(`not built yet: connect.connectionOf ${code}`)),
    sealState: (userId) => {
      throw new Error(`not built yet: connect.sealState ${userId}`);
    },
    openState: (value, userId) => {
      throw new Error(`not built yet: connect.openState ${String(value)} ${userId}`);
    },
  };
  return { service, connect, address: (name) => gameAddress(pattern, name) };
}

// The bucket is looked up each time it is used, not once: on Cloudflare the binding belongs to the request that is
// running (see src/lib/server/files.ts).
const currentFiles: FileStore = {
  head: (key) => fileStore().head(key),
  get: (key, range) => fileStore().get(key, range),
  put: (key, bytes) => fileStore().put(key, bytes),
  delete: (key) => fileStore().delete(key),
};

let shared: GamesServices | undefined;

/** The process-wide games services, created on first use. */
export function gamesServices(): GamesServices {
  shared ??= createGamesServices(process.env, { db: prisma(), clock: systemClock, files: currentFiles });
  return shared;
}
