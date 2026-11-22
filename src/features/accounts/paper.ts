import type { PrismaClient } from "../../lib/server/db.ts";

/**
 * Keeps the email a member paid with, for the few legal emails and for a reset code when Twilio cannot say a number is
 * still theirs. Nobody types it into Ruken: checkout hands over the address Stripe collected.
 */
export async function setPaperEmail(
  db: Pick<PrismaClient, "user">,
  userId: string,
  email: string,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { paperEmail: email.trim().toLowerCase() } });
}
