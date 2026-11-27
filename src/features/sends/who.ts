import type { PrismaClient } from "../../lib/server/db.ts";

// Who may send games to whom (the owner, 2026-11-27: "friends just means you follow each other, friends can send
// games"). One rule, read by the send and by the faces in the share sheet, so a face never shows that a send refuses.

/** True only when each of the two follows the other. */
export async function canSend(db: PrismaClient, fromId: string, toId: string): Promise<boolean> {
  if (fromId === toId) return false;
  const rows = await db.makerFollow.count({
    where: {
      OR: [
        { followerId: fromId, makerId: toId },
        { followerId: toId, makerId: fromId },
      ],
    },
  });
  return rows === 2;
}

/**
 * The pages of this person's friends, newest friendship first (a friendship starts with the later of its two follows),
 * at most `max`. A friend with no page has no address to send to, so is left out. One statement, so a game's page waits
 * on it once.
 */
export async function friendPagesOf(
  db: PrismaClient,
  userId: string,
  max: number,
): Promise<{ handle: string; name: string; photoKey: string | null }[]> {
  return db.$queryRaw<{ handle: string; name: string; photoKey: string | null }[]>`
    SELECT page."handle", page."name", page."photoKey"
    FROM "MakerFollow" mine
    JOIN "MakerFollow" theirs ON theirs."followerId" = mine."makerId" AND theirs."makerId" = mine."followerId"
    JOIN "MakerPage" page ON page."userId" = mine."makerId"
    WHERE mine."followerId" = ${userId}
    ORDER BY GREATEST(mine."followedAt", theirs."followedAt") DESC, mine."makerId"
    LIMIT ${max}
  `;
}
