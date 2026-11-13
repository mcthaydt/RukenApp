import type { PrismaClient, StaffRole } from "../../lib/server/db.ts";

export function staffRolesOf(db: PrismaClient, userId: string): Promise<StaffRole[]> {
  throw new Error(`not built yet (${typeof db} ${userId})`);
}
