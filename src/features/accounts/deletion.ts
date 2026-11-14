import type { Clock } from "../../lib/clock.ts";
import type { FileStore } from "../../lib/files/store.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

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

/** What the daily job needs besides that: the bucket a person's files (their photo) are kept in. */
export interface PurgeDeps extends DeletionDeps {
  readonly files: FileStore;
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
      const open = await openRequest(tx, userId);
      if (open !== null) return { purgeAfter: open.purgeAfter };

      await tx.deletionRequest.create({ data: { userId, requestedAt: new Date(now), purgeAfter } });
      await tx.user.update({ where: { id: userId }, data: { status: "pending_deletion" } });
      // Signed out everywhere: the next request from any of the person's devices is signed out.
      await tx.session.deleteMany({ where: { userId } });
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
 * Each account is finished in a transaction of its own, so one that fails leaves the others done. The request is
 * claimed first (only the run that marks it purged goes on), so two runs at once never both finish the same
 * account. The `User` row stays, as a tombstone with nothing of the person in it, so the payment rows that point
 * at it stay true. A later slice that stores more of a person adds its own removal here, with a test.
 */
export async function purgeDueAccounts(deps: PurgeDeps): Promise<number> {
  const { prisma, clock, files } = deps;
  const now = new Date(clock.epochMs());
  const due = await prisma.deletionRequest.findMany({
    where: { cancelledAt: null, purgedAt: null, purgeAfter: { lte: now } },
    select: { id: true, userId: true },
  });

  let finished = 0;
  for (const { id, userId } of due) {
    // A photo is served to anyone who has its address, so it goes before the page that points at it. It goes first
    // and not after: if the bucket fails, the account is not yet marked done and tomorrow's run tries again, where a
    // photo left behind once the page is gone would have nothing pointing at it to be found by. A missing file is
    // not an error, so a run that comes back to an account an earlier run half finished is fine.
    const page = await prisma.makerPage.findUnique({ where: { userId }, select: { photoKey: true } });
    if (page !== null && page.photoKey !== null) await files.delete(page.photoKey);

    const done = await prisma.$transaction(async (tx) => {
      const claimed = await tx.deletionRequest.updateMany({
        where: { id, cancelledAt: null, purgedAt: null },
        data: { purgedAt: now },
      });
      if (claimed.count === 0) return false;

      const { email } = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      // What GitHub said the person can reach is theirs; their repositories go with their installations.
      await tx.gitHubInstallation.deleteMany({ where: { userId } });
      // The person's page, and its links with it, so the address is free for someone else. It stays up for the 14
      // days of the wait, and goes only here.
      await tx.makerPage.deleteMany({ where: { userId } });
      // A mail link is kept by address, or by the person's id (a password reset), so both are cleared.
      await tx.verification.deleteMany({
        where: { OR: [{ identifier: email }, { value: email }, { value: userId }] },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          status: "deleted",
          // `.invalid` can never be a real address (RFC 2606), and the person's own address is free to sign up again.
          email: `deleted-${userId}@deleted.invalid`,
          name: "Deleted",
          emailVerified: false,
          image: null,
          adultOn: null,
        },
      });
      return true;
    });
    if (done) finished += 1;
  }
  return finished;
}
