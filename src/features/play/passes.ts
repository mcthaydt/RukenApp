import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { makePass, newPassId, PASS_LIFE_MS, PASS_MIN_LEFT_MS } from "./pass.ts";

// Handing out play passes. A member keeps one pass per game, and per version of its files, for a day, so the game's
// addresses stay the same and the browser keeps the files it already downloaded (a game can be 90 MB). Every pass is a
// row that names one person, so a leaked address leads to one member.

export interface PassDeps {
  db: PrismaClient;
  clock: Clock;
  passSecret: string;
}

/**
 * The pass for this person to load this pull of this game. The newest row for the game, the pull and the person
 * (`userId` null: the one shared pass of a free game, for everyone signed out) that still has at least
 * `PASS_MIN_LEFT_MS` to run: the pass made again from that row, which is the same string the browser already has.
 * None: a new row and its pass. Two Plays at the same moment may make two rows for one person; both passes work, and
 * each traces to that person.
 *
 * It does not ask whether the person may play. `startPlay` does that first, so a member whose membership ended gets no
 * pass however recently they had one.
 */
export async function passFor(
  deps: PassDeps,
  input: {
    game: { id: string; publicId: string };
    pull: { id: string; connectHosts: string[] };
    userId: string | null;
  },
): Promise<string> {
  const nowMs = deps.clock.epochMs();
  const claimsFor = (id: string, expiresAtMs: number) => ({
    id,
    game: input.game.publicId,
    pull: input.pull.id,
    connect: input.pull.connectHosts,
    expiresAtMs,
  });

  const existing = await deps.db.playPass.findFirst({
    where: {
      gameId: input.game.id,
      pullId: input.pull.id,
      userId: input.userId,
      expiresAt: { gte: new Date(nowMs + PASS_MIN_LEFT_MS) },
    },
    orderBy: { expiresAt: "desc" },
    select: { id: true, expiresAt: true },
  });
  if (existing !== null) {
    return makePass(claimsFor(existing.id, existing.expiresAt.getTime()), deps.passSecret);
  }

  const id = newPassId();
  const expiresAtMs = nowMs + PASS_LIFE_MS;
  await deps.db.playPass.create({
    data: {
      id,
      gameId: input.game.id,
      pullId: input.pull.id,
      userId: input.userId,
      madeAt: new Date(nowMs),
      expiresAt: new Date(expiresAtMs),
    },
  });
  return makePass(claimsFor(id, expiresAtMs), deps.passSecret);
}
