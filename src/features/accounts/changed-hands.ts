import type { MailMessage } from "../../lib/server/mail.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Texter } from "../../lib/server/text.ts";

// Where a forgot-password code goes. A phone number can change hands: its owner leaves the carrier and the number is
// given to a stranger. A code texted to that number would then let the stranger take over the account, so the number
// is checked first, where Twilio can say (United States numbers, once Twilio turns the check on). Where it cannot say,
// an account that has money in it gets its code at the email the member paid with, never at the number.

export interface ResetChannelDeps {
  db: PrismaClient;
  texter: Texter;
  /** Whether the account has ever paid or been paid. Handed in from above: `accounts` sits below the features that know. */
  hasMoney(userId: string): Promise<boolean>;
}

export type ResetChannel = "text" | "email" | "help";

/**
 * The newest moment the person is known to have held the number: their latest session, or the last time a code proved
 * it. An account with neither is as old as the account itself.
 */
async function heldSince(db: PrismaClient, user: { id: string }): Promise<Date> {
  const [session, row] = await Promise.all([
    db.session.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { phoneConfirmedAt: true, createdAt: true },
    }),
  ]);
  const known = [session?.createdAt, row.phoneConfirmedAt].filter((date): date is Date => date != null);
  if (known.length === 0) return row.createdAt;
  return new Date(Math.max(...known.map((date) => date.getTime())));
}

/**
 * 1. since is the newest of the account's sessions and its last confirmation;
 * 2. Twilio says the number did not change hands since then: text;
 * 3. Twilio cannot say and the account never touched money: text (locking out everyone who never paid would be worse);
 * 4. otherwise (changed hands, or cannot say with money): the email the member pays with, or help when there is none.
 */
export async function resetChannel(
  deps: ResetChannelDeps,
  user: { id: string; phoneNumber: string; paperEmail: string | null },
): Promise<ResetChannel> {
  const since = await heldSince(deps.db, user);
  const hands = await deps.texter.changedHands(user.phoneNumber, since);
  if (hands === "no") return "text";
  if (hands === "cannot_say" && !(await deps.hasMoney(user.id))) return "text";
  return user.paperEmail === null ? "help" : "email";
}

let moneyCheck: (userId: string) => Promise<boolean> = () => Promise.resolve(true);

/**
 * The site hands in what it knows about money at start (hooks.server.ts), the way it hands in the file store. Until
 * then every account counts as having money, so a reset never goes by text on a guess.
 */
export function setMoneyCheck(check: (userId: string) => Promise<boolean>): void {
  moneyCheck = check;
}

export function userHasMoney(userId: string): Promise<boolean> {
  return moneyCheck(userId);
}

/** The reset code's email, for a member whose number may have changed hands. Sent to the email they paid with. */
export function resetCodeMessage(to: string, code: string): MailMessage {
  return {
    to,
    subject: "Your Ruken code",
    text: `Your code to choose a new password is ${code}. It works for 10 minutes.`,
  };
}
