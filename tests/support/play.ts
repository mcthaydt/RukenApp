import { createHash, randomBytes } from "node:crypto";
import { newPublicId } from "../../src/features/games/ids.ts";
import type { PrismaClient } from "../../src/lib/server/db.ts";
import { createUser } from "./create-user.ts";

let games = 0;

/** A game and a pull of its files (a play pass and a session point at both), made by a new maker, or by `maker`. */
export async function addGame(
  prisma: PrismaClient,
): Promise<{ gameId: string; pullId: string; makerUserId: string }> {
  games += 1;
  const makerUserId = await createUser(prisma);
  const game = await prisma.game.create({
    data: {
      publicId: newPublicId(),
      slug: `rollup-game-${String(games)}`,
      makerUserId,
      name: "A game",
      oneLine: "A game about a thing.",
      playsOn: "phone_and_computer",
      repoFullName: "acme/game",
    },
  });
  const pull = await prisma.gamePull.create({
    data: {
      id: crypto.randomUUID(),
      gameId: game.id,
      commitSha: "a".repeat(40),
      fileCount: 3,
      totalBytes: 1000n,
      connectHosts: [],
      pulledAt: new Date("2026-11-01T00:00:00Z"),
    },
  });
  return { gameId: game.id, pullId: pull.id, makerUserId };
}

export interface SessionSetup {
  readonly userId: string | null;
  readonly basis: "member" | "free_game" | "staff" | "own_game";
  /** When the session started, as text. */
  readonly startedAt: string;
  /** How many beats it sent, and how far apart (seconds). The first comes one step after the start. */
  readonly beats: number;
  readonly everySeconds: number;
  /** False for beats that say the person looked away. */
  readonly attentive?: boolean;
}

/** One play session of a game, with its beats, as slice 2 stores them. Answers the session's id. */
export async function addSession(
  prisma: PrismaClient,
  game: { gameId: string; pullId: string },
  setup: SessionSetup,
): Promise<string> {
  const startedMs = Date.parse(setup.startedAt);
  const id = randomBytes(12).toString("hex");
  const pass = randomBytes(16).toString("base64url"); // 22 characters, as a pass id is
  await prisma.playPass.create({
    data: {
      id: pass,
      gameId: game.gameId,
      pullId: game.pullId,
      userId: setup.userId,
      madeAt: new Date(startedMs),
      expiresAt: new Date(startedMs + 24 * 3600 * 1000),
    },
  });
  await prisma.playSession.create({
    data: {
      id,
      gameId: game.gameId,
      pullId: game.pullId,
      passId: pass,
      userId: setup.userId,
      basis: setup.basis,
      tokenHash: createHash("sha256").update(id).digest("hex"),
      startedAt: new Date(startedMs),
    },
  });
  await prisma.playBeat.createMany({
    data: Array.from({ length: setup.beats }, (_, index) => ({
      sessionId: id,
      receivedAt: new Date(startedMs + (index + 1) * setup.everySeconds * 1000),
      attentive: setup.attentive ?? true,
    })),
  });
  return id;
}
