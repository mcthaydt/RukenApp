import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { ClipShape, PrismaClient } from "../../lib/server/db.ts";

// What a game goes through, from its first clip to going live. It is built from what it needs (the database, the
// clock, the bucket, GitHub) so a test hands it stand-ins and no test reaches for the real ones.

/** What went wrong, in a code the screens can act on; the message is in words for a person. */
export type GameErrorCode = "INVALID" | "NOT_FOUND" | "NOT_CONNECTED" | "FILES_REFUSED" | "NOT_READY";

export class GameError extends Error {
  readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.name = "GameError";
    this.code = code;
  }
}

/** Filled in when the GitHub App arrives. */
export type GitHub = Record<string, never>;

export interface GamesServiceDeps {
  db: PrismaClient;
  clock: Clock;
  files: FileStore;
  github: GitHub;
}

export function createGamesService(deps: GamesServiceDeps) {
  function saveClip(
    gameId: string,
    shape: ClipShape,
    upload: { contentType: string; bytes: Uint8Array },
  ): Promise<void> {
    return Promise.reject(
      new Error(`not built yet: ${gameId} ${shape} ${upload.contentType} ${typeof deps}`),
    );
  }

  return { saveClip };
}

export type GamesService = ReturnType<typeof createGamesService>;
