import { systemClock, type Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import { prisma, type PrismaClient } from "../../lib/server/db.ts";
import { isThisMachine } from "../../lib/this-machine.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { fileStore } from "../../lib/server/files.ts";
import { frameMaker } from "../../lib/server/frames.ts";
import { checkAddressPattern, gameAddress } from "./addresses.ts";
import {
  connectionOf,
  installUrl,
  openState,
  sealState,
  signInUrl,
  type Connection,
} from "./github-connect.ts";
import { createGitHub } from "./github.ts";
import { decisionSchedule, type DecisionSchedule } from "./seats.ts";
import { createGamesService, type GamesService } from "./service.ts";
import { STILL_PATH, stillOf, type FrameMaker, type StillAnswer } from "./stills.ts";

// Everything the games feature needs, built once per server process from the settings. Routes call
// gamesServices(); tests build their own with createGamesServices.

type Settings = Readonly<Record<string, string | undefined>>;

/** What the connect screens need, with the app's settings and the clock already in it. */
export interface GitHubConnect {
  signInUrl(state: string): string;
  installUrl(state: string): string;
  connectionOf(code: string): Promise<Connection[]>;
  /** The state for a connection started by `userId`, for the game (its address) the maker is answering, or none. */
  sealState(userId: string, game: string | null): string;
  /** The game the state was sealed for, or undefined when it does not open for this account. */
  openState(value: string | undefined, userId: string): { game: string | null } | undefined;
}

export interface GamesServices {
  service: GamesService;
  connect: GitHubConnect;
  /** The address a game is played at, from its public id (`g-<id>`). */
  address(name: string): string;
  /** The address of a clip, from its key in the bucket: the media address, a slash, the key. */
  media(key: string): string;
  /** Where a page asks for a clip's still, from the clip's key; the page adds the second and the width it wants. */
  stillAddress(key: string): string;
  /** A clip's still at `second`, `width` wide, made once and kept (stills.ts). */
  still(key: string, second: number, width: number): Promise<StillAnswer>;
}

/**
 * The decision day schedule the site uses. The journeys' site sets DECISION_DAYS_TEST_OFF=on, so every journey that lets a
 * game in keeps seeing it go live at once whatever day it runs. Like LAUNCH_TEST_SWITCH it is refused unless the site's
 * own address is this machine, so a real site that has it set by mistake fails instead of quietly skipping decision day.
 */
export function scheduleFor(source: Settings): DecisionSchedule {
  const flag = source.DECISION_DAYS_TEST_OFF;
  if (flag === undefined || flag === "") return decisionSchedule;
  if (flag !== "on" || !isThisMachine(source.BETTER_AUTH_URL)) {
    throw new Error(
      "DECISION_DAYS_TEST_OFF is for tests on this machine. Remove it from this site's settings.",
    );
  }
  return { ...decisionSchedule, firstDay: null };
}

/** The only place GitHub's addresses may be changed: a stand-in server on this machine, for the journeys. */
const STAND_IN_GITHUB = "http://127.0.0.1:";

/**
 * A GitHub address setting that only a stand-in on this machine may change. Refused at start, so a real site can never
 * be pointed at a stand-in that answers with whatever it likes.
 */
function standInAddress(name: string, source: Settings): string | undefined {
  const value = optionalEnv(name, source);
  if (value !== undefined && !value.startsWith(STAND_IN_GITHUB)) {
    throw new Error(`${name} is for a stand-in on this machine only: it must start with ${STAND_IN_GITHUB}`);
  }
  return value;
}

/**
 * Reads the settings first, so a missing one stops the start with its name before anything is connected. `parts` are
 * what the games borrow from the site: the database, the clock and the bucket.
 */
export function createGamesServices(
  source: Settings,
  parts: { db: PrismaClient; clock: Clock; files: FileStore; frame?: () => FrameMaker | null },
): GamesServices {
  const appId = requireEnv("GITHUB_APP_ID", source);
  const privateKeyPem = requireEnv("GITHUB_APP_PRIVATE_KEY", source);
  const pattern = requireEnv("GAME_ADDRESS_PATTERN", source);
  checkAddressPattern(pattern);
  const apiBase = standInAddress("GITHUB_API_BASE", source);
  const webBase = standInAddress("GITHUB_WEB_BASE", source);
  const clientId = requireEnv("GITHUB_APP_CLIENT_ID", source);
  const clientSecret = requireEnv("GITHUB_APP_CLIENT_SECRET", source);
  const appSlug = requireEnv("GITHUB_APP_SLUG", source);
  // The site's own secret, as for the arrival cookie: never the play pass secret, which the gate holds too.
  const stateSecret = requireEnv("BETTER_AUTH_SECRET", source);

  const github = createGitHub({
    appId,
    privateKeyPem,
    clock: parts.clock,
    ...(apiBase === undefined ? {} : { apiBase }),
  });
  const service = createGamesService({
    db: parts.db,
    clock: parts.clock,
    files: parts.files,
    github,
    schedule: scheduleFor(source),
  });
  // Each is given only the addresses that were set, so an unset one keeps the library's own (GitHub's).
  const addresses = {
    ...(apiBase === undefined ? {} : { apiBase }),
    ...(webBase === undefined ? {} : { webBase }),
  };
  const connect: GitHubConnect = {
    signInUrl: (state) => signInUrl({ clientId, state, ...(webBase === undefined ? {} : { webBase }) }),
    installUrl: (state) => installUrl({ appSlug, state, ...(webBase === undefined ? {} : { webBase }) }),
    connectionOf: (code) => connectionOf({ code, clientId, clientSecret, ...addresses }),
    sealState: (userId, game) => sealState(userId, parts.clock.epochMs(), stateSecret, game),
    openState: (value, userId) => openState(value, userId, parts.clock.epochMs(), stateSecret),
  };
  return {
    service,
    connect,
    address: (name) => gameAddress(pattern, name),
    media: (key) => `${gameAddress(pattern, "media")}/${key}`,
    stillAddress: (key) => `${STILL_PATH}${key}`,
    still: (key, second, width) =>
      stillOf({ files: parts.files, frame: parts.frame?.() ?? null }, key, second, width),
  };
}

// The bucket is looked up each time it is used, not once: on Cloudflare the binding belongs to the request that is
// running (see src/lib/server/files.ts).
const currentFiles: FileStore = {
  head: (key) => fileStore().head(key),
  get: (key, range) => fileStore().get(key, range),
  put: (key, bytes) => fileStore().put(key, bytes),
  delete: (key) => fileStore().delete(key),
  deleteAll: (prefix) => fileStore().deleteAll(prefix),
  hasAny: (prefix) => fileStore().hasAny(prefix),
};

let shared: GamesServices | undefined;

/** The process-wide games services, created on first use. */
export function gamesServices(): GamesServices {
  shared ??= createGamesServices(process.env, {
    db: prisma(),
    clock: systemClock,
    files: currentFiles,
    frame: frameMaker,
  });
  return shared;
}
