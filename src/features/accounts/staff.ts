import type { PrismaClient, StaffRole } from "../../lib/server/db.ts";

/**
 * The person's staff roles, read fresh from StaffAssignment each time (empty for a player). Nothing
 * grants a role in slice 1; the admin portal does that later.
 */
export async function staffRolesOf(db: PrismaClient, userId: string): Promise<StaffRole[]> {
  const rows = await db.staffAssignment.findMany({ where: { userId }, select: { role: true } });
  return rows.map((row) => row.role);
}
