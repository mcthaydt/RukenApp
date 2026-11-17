import type { PrismaClient, StaffRole } from "../../lib/server/db.ts";

/**
 * The person's staff roles, read fresh from StaffAssignment each time (empty for a player). Nothing
 * grants a role but the first-owner command (`grantFirstOwner`); the admin portal does the rest later.
 */
export async function staffRolesOf(db: PrismaClient, userId: string): Promise<StaffRole[]> {
  const rows = await db.staffAssignment.findMany({ where: { userId }, select: { role: true } });
  return rows.map((row) => row.role);
}

export type FirstOwnerOutcome = "granted" | "already_one" | "no_account";

/**
 * Makes the account with this address the owner, but only while no one is staff at all, so it can make the first
 * staff account and never a second. Nothing in the app grants a role (the admin portal will), and without a first
 * owner nobody could accept a game. The count and the grant happen under one lock, so two calls at the same moment
 * cannot both see an empty table.
 */
export function grantFirstOwner(db: PrismaClient, email: string): Promise<FirstOwnerOutcome> {
  return db.$transaction(async (tx): Promise<FirstOwnerOutcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('first-owner', 0))`;
    if ((await tx.staffAssignment.count()) > 0) return "already_one";
    // Sign-up keeps addresses in lower case; what a person typed here may not be.
    const user = await tx.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (user === null) return "no_account";
    await tx.staffAssignment.create({ data: { userId: user.id, role: "owner" } });
    return "granted";
  });
}
