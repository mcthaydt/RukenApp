import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { lockComputers } from "./computer-keys.ts";
import { forgetPending } from "./pending-sign-up.ts";

// "Delete my account".
//
// Asking starts a 14-day wait. During it the account is `pending_deletion`: every read treats it like a
// signed-out stranger (handle.ts) and every session is gone, so the person is signed out everywhere at once.
// Signing in again before `purgeAfter` undoes it (`restoreOnSignIn`, called when a session is made). After the
// 14 days the daily job (`purgeDueAccounts`) removes the person's details and leaves a tombstone.

/** How long a person has to change their mind. */
export const DELETION_WAIT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What deletion needs: a database and the time. */
export interface DeletionDeps {
  readonly prisma: PrismaClient;
  readonly clock: Clock;
}

/**
 * What the daily job needs besides that: the bucket a person's files (their photo) are kept in, and the server's
 * secret, which a number's kept sign-ups are found by (they hold only keyed hashes).
 */
export interface PurgeDeps extends DeletionDeps {
  readonly files: FileStore;
  readonly secret: string;
}

/** Prisma's "unique constraint failed" error (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** The open request (at most one: a partial unique index), if any. */
function openRequest(db: Pick<PrismaClient, "deletionRequest">, userId: string) {
  return db.deletionRequest.findFirst({
    where: { userId, cancelledAt: null, purgedAt: null },
    select: { purgeAfter: true },
  });
}

/**
 * Starts the wait for a person, or answers the date of the wait already running (asking twice changes
 * nothing). A person with a staff role gets "staff" and nothing changes: staff are removed by another staff
 * member, so access is never ended by accident.
 */
export async function requestDeletion(
  deps: DeletionDeps,
  userId: string,
): Promise<{ purgeAfter: Date } | "staff"> {
  const { prisma, clock } = deps;
  if ((await prisma.staffAssignment.count({ where: { userId } })) > 0) return "staff";

  const now = clock.epochMs();
  const purgeAfter = new Date(now + DELETION_WAIT_DAYS * DAY_MS);
  try {
    return await prisma.$transaction(async (tx) => {
      await lockComputers(tx, userId);
      const open = await openRequest(tx, userId);
      if (open !== null) return { purgeAfter: open.purgeAfter };

      await tx.deletionRequest.create({ data: { userId, requestedAt: new Date(now), purgeAfter } });
      await tx.user.update({ where: { id: userId }, data: { status: "pending_deletion" } });
      // Signed out everywhere: the next request from any of the person's devices is signed out.
      await tx.session.deleteMany({ where: { userId } });
      // And every computer's key: a key stops working with the sessions.
      await tx.computerKey.deleteMany({ where: { userId } });
      await tx.computerSignIn.deleteMany({ where: { userId } });
      return { purgeAfter };
    });
  } catch (error) {
    // Two requests at the same moment: the partial unique index lets one in. The other answers with the
    // request that won, as a second request after the first would.
    if (isUniqueViolation(error)) {
      const open = await openRequest(prisma, userId);
      if (open !== null) return { purgeAfter: open.purgeAfter };
    }
    throw error;
  }
}

/**
 * Sign-in calls this for every new session. Within the 14 days it cancels the waiting deletion and makes the
 * account active again, and answers true so sign-in can say "Welcome back. Your account will not be deleted."
 * Otherwise (nothing waiting, or the 14 days are over and only the daily job is left) it changes nothing and
 * answers false; such an account stays signed out.
 */
export async function restoreOnSignIn(prisma: PrismaClient, clock: Clock, userId: string): Promise<boolean> {
  const now = new Date(clock.epochMs());
  return prisma.$transaction(async (tx) => {
    const cancelled = await tx.deletionRequest.updateMany({
      where: { userId, cancelledAt: null, purgedAt: null, purgeAfter: { gt: now } },
      data: { cancelledAt: now },
    });
    if (cancelled.count === 0) return false;
    await tx.user.update({ where: { id: userId }, data: { status: "active" } });
    return true;
  });
}

/**
 * The daily job: finishes every deletion whose 14 days are over, and answers how many it finished.
 *
 * Each account is finished on its own: one that fails stays open for the next run, the others are still finished, and
 * the run then throws, naming how many failed. Each is finished in a transaction of its own. The request is
 * claimed first (only the run that marks it purged goes on), so two runs at once never both finish the same
 * account. The `User` row stays, as a tombstone with nothing of the person in it, so the payment rows that point
 * at it stay true. A later slice that stores more of a person adds its own removal here, with a test.
 */
export async function purgeDueAccounts(deps: PurgeDeps): Promise<number> {
  const { prisma, clock } = deps;
  const now = new Date(clock.epochMs());
  const due = await prisma.deletionRequest.findMany({
    where: { cancelledAt: null, purgedAt: null, purgeAfter: { lte: now } },
    select: { id: true, userId: true },
  });

  let finished = 0;
  const failures: unknown[] = [];
  for (const { id, userId } of due) {
    // One account that fails (the bucket, or the database) is left open for tomorrow's run and does not stop the rest.
    try {
      if (await purgeOne(deps, id, userId, now)) finished += 1;
    } catch (error) {
      // Each failure is logged with its account, since the run's own error carries only the counts.
      console.error(`Deleting the account of user ${userId} failed; the next run tries again.`, error);
      failures.push(error);
    }
  }
  // The run still fails loudly, so the daily job's address answers an error and Cloudflare shows the run as failed.
  if (failures.length > 0)
    throw new AggregateError(
      failures,
      `${String(failures.length)} account(s) could not be deleted; ${String(finished)} were.`,
    );
  return finished;
}

/** Finishes one person's deletion. Answers false when another run claimed it first. */
async function purgeOne(deps: PurgeDeps, id: string, userId: string, now: Date): Promise<boolean> {
  const { prisma, files } = deps;
  // A photo is served to anyone who has its address, so it goes before the page that points at it. It goes first
  // and not after: if the bucket fails, the account is not yet marked done and tomorrow's run tries again, where a
  // photo left behind once the page is gone would have nothing pointing at it to be found by. A missing file is
  // not an error, so a run that comes back to an account an earlier run half finished is fine.
  const page = await prisma.makerPage.findUnique({ where: { userId }, select: { photoKey: true } });
  if (page !== null && page.photoKey !== null) await files.delete(page.photoKey);
  // The person's games come off Ruken with them (the owner's decision, 2026-11-21): their files and videos go from
  // the bucket first, for the same reason as the photo.
  const games = await prisma.game.findMany({ where: { makerUserId: userId }, select: { publicId: true } });
  for (const { publicId } of games) {
    await files.deleteAll(`files/${publicId}/`);
    await files.deleteAll(`clips/${publicId}/`);
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.deletionRequest.updateMany({
      where: { id, cancelledAt: null, purgedAt: null },
      data: { purgedAt: now },
    });
    if (claimed.count === 0) return false;

    const { email, phoneNumber } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, phoneNumber: true },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    // What GitHub said the person can reach is theirs; their repositories go with their installations.
    await tx.gitHubInstallation.deleteMany({ where: { userId } });
    // The games a person wanted are theirs. The launch email's row (`WishlistMail`) is left: it holds only the
    // tombstone's id and when a mail went, and is add-only, so the job still finds it and never mails twice.
    await tx.wishlist.deleteMany({ where: { userId } });
    // What the person told Ruken about games is theirs too.
    await tx.gameReport.deleteMany({ where: { userId } });
    // What the person told the feed is theirs, and so is everyone's chip for them or their games: a maker who has left
    // is no one to see more or less of. The rows are deleted here because the account's row stays, so no cascade runs.
    await tx.feedTaste.deleteMany({
      where: { OR: [{ userId }, { makerUserId: userId }, { game: { makerUserId: userId } }] },
    });
    await tx.goodPickAsked.deleteMany({ where: { userId } });
    // A teen's asks for a parent's yes, and any yes, are theirs.
    await tx.parentAsk.deleteMany({ where: { teenUserId: userId } });
    // What the person liked, saved and reposted is theirs, and every mark on their own games goes with the games.
    await tx.gameMark.deleteMany({ where: { OR: [{ userId }, { game: { makerUserId: userId } }] } });
    // Whom the person follows, and who follows them: both sides of a follow name the account.
    await tx.makerFollow.deleteMany({ where: { OR: [{ followerId: userId }, { makerId: userId }] } });
    // The games the person sent and was sent: every row names the account.
    await tx.gameSend.deleteMany({ where: { OR: [{ fromId: userId }, { toId: userId }] } });
    // The person's page, and its links with it, so the address is free for someone else. It stays up for the 14
    // days of the wait, and goes only here.
    await tx.makerPage.deleteMany({ where: { userId } });
    await takeGamesOff(tx, userId);
    // A code is kept by the number (and, for a password reset, by the number and a suffix), a mail link by address
    // or by the person's id, so every way is cleared. A sign-up kept for the number goes too.
    const kept = [{ identifier: email }, { value: email }, { value: userId }];
    if (phoneNumber !== null) {
      kept.push({ identifier: phoneNumber }, { identifier: `${phoneNumber}-request-password-reset` });
      await forgetPending({ db: tx, secret: deps.secret }, phoneNumber);
    }
    await tx.verification.deleteMany({ where: { OR: kept } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "deleted",
        // `.invalid` can never be a real address (RFC 2606), and the person's own address is free to sign up again.
        email: `deleted-${userId}@deleted.invalid`,
        name: "Deleted",
        emailVerified: false,
        // The number is free for someone else (or for the same person, signing up again).
        phoneNumber: null,
        phoneNumberVerified: false,
        phoneConfirmedAt: null,
        paperEmail: null,
        image: null,
        adultOn: null,
      },
    });
    return true;
  });
}

/**
 * A leaving person's games come off Ruken, as their own Take off and Throw away do, so nobody can find or play them and
 * staff are not asked to review them. A live or waiting game is taken off; a draft or sent-back game is thrown away,
 * which frees its name (a draft may not have every answer a game that is off Ruken must keep). The rows stay, because
 * money and records may point at a game. Their videos' rows go; the videos themselves were deleted just before.
 */
async function takeGamesOff(
  tx: Pick<PrismaClient, "game" | "gameClip" | "gameHeldClip">,
  userId: string,
): Promise<void> {
  // A live game's change that waited for a yes goes with it: the database holds such a change to a live game, so the
  // columns are cleared in the same write that takes the game off. The held videos' files share the game's folder of
  // clips, which was deleted just before. The games come first and their held rows after, the order staff's yes takes
  // its locks in (the game, then the held rows); the other way round, the two can wait on each other.
  await tx.game.updateMany({
    where: { makerUserId: userId, state: { in: ["live", "waiting"] } },
    data: {
      state: "taken_off",
      stateReason: null,
      livePullId: null,
      pendingPullId: null,
      pendingSince: null,
      heldAgeRating: null,
      heldContentMarks: [],
      toFix: [],
    },
  });
  await tx.gameHeldClip.deleteMany({ where: { game: { makerUserId: userId } } });
  // Each thrown-away game's address is made from its own public id, so they are changed one at a time.
  const unsent = await tx.game.findMany({
    where: { makerUserId: userId, state: { in: ["draft", "sent_back"] } },
    select: { id: true, publicId: true },
  });
  for (const game of unsent) {
    await tx.game.update({
      where: { id: game.id },
      data: {
        state: "thrown_away",
        slug: `x-${game.publicId}`,
        pendingPullId: null,
        pendingSince: null,
        toFix: [],
      },
    });
  }
  await tx.gameClip.deleteMany({ where: { game: { makerUserId: userId } } });
}
