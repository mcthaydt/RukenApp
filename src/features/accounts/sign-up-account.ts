import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { forgetPending } from "./pending-sign-up.ts";

// The last step of sign-up. better-auth's `verify` makes the user (a number, confirmed) and a session when the code is
// right, and knows nothing of the password or the age the person gave on the first screen. This turns that user into
// an account that can sign in.

export interface MakeAccountDeps {
  db: PrismaClient;
  clock: Clock;
  /** BETTER_AUTH_SECRET, the key for the kept sign-up's hashes. */
  secret: string;
}

/**
 * Gives the new user the password and the 18th birthday this browser kept, and the time the code proved the number, in
 * one transaction; then every browser's kept sign-up for the number is forgotten. The age is written only where none is
 * set yet, as `setBirthDate` writes it.
 */
export async function makeAccount(
  deps: MakeAccountDeps,
  input: { userId: string; number: string; passwordHash: string; adultOn: Date },
): Promise<void> {
  await deps.db.$transaction(async (tx) => {
    await tx.account.create({
      data: {
        userId: input.userId,
        providerId: "credential",
        accountId: input.userId,
        password: input.passwordHash,
      },
    });
    await tx.user.updateMany({
      where: { id: input.userId, adultOn: null },
      data: { adultOn: input.adultOn },
    });
    await tx.user.update({
      where: { id: input.userId },
      data: { phoneConfirmedAt: new Date(deps.clock.epochMs()) },
    });
    await forgetPending({ db: tx, secret: deps.secret }, input.number);
  });
}

/** Takes back a user and its sessions that `verify` made, when the rest of sign-up could not be finished. */
export async function removeHalfMadeAccount(db: PrismaClient, userId: string): Promise<void> {
  await db.$transaction([
    db.session.deleteMany({ where: { userId } }),
    db.user.deleteMany({ where: { id: userId } }),
  ]);
}
