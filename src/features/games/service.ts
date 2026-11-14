import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { ClipShape, PrismaClient } from "../../lib/server/db.ts";
import { clipKeyFor, clipProblem, type ClipContentType } from "./clips.ts";

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

/** 16 random hex characters: what gives each uploaded clip an address of its own (see `clipKeyFor`). */
function randomHex16(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function createGamesService(deps: GamesServiceDeps) {
  /**
   * Keeps a clip for a game, in place of the one of that shape it had. A clip that fails the clip rules is refused
   * before anything is stored. The new file is stored and the row points at it before the old file is deleted, so a
   * failure part way leaves the game with its old clip, and at worst a file nobody points at.
   */
  async function saveClip(
    gameId: string,
    shape: ClipShape,
    upload: { contentType: string; bytes: Uint8Array },
  ): Promise<void> {
    const problem = clipProblem(upload);
    if (problem !== null) throw new GameError("INVALID", problem);
    // `clipProblem` returned null, so the type is one of the two a clip may have.
    const contentType = upload.contentType as ClipContentType;

    const game = await deps.db.game.findUnique({ where: { id: gameId }, select: { publicId: true } });
    if (game === null) throw new GameError("NOT_FOUND", "We can't find that game.");

    const key = clipKeyFor(game.publicId, shape, randomHex16(), contentType);
    const replaced = await deps.db.gameClip.findUnique({ where: { gameId_shape: { gameId, shape } } });

    await deps.files.put(key, upload.bytes);
    await deps.db.gameClip.upsert({
      where: { gameId_shape: { gameId, shape } },
      create: { gameId, shape, key, contentType, bytes: upload.bytes.length },
      update: { key, contentType, bytes: upload.bytes.length },
    });
    if (replaced !== null) await deps.files.delete(replaced.key);
  }

  return { saveClip };
}

export type GamesService = ReturnType<typeof createGamesService>;
