import type { PrismaClient, StaffRole } from "../../lib/server/db.ts";
import { toE164 } from "./phone.ts";

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
 * Makes the account with this phone number the owner, but only while no one is staff at all, so it can make the first
 * staff account and never a second. Nothing in the app grants a role (the admin portal will), and without a first
 * owner nobody could accept a game. The count and the grant happen under one lock, so two calls at the same moment
 * cannot both see an empty table.
 */
export function grantFirstOwner(db: PrismaClient, phoneNumber: string): Promise<FirstOwnerOutcome> {
  return db.$transaction(async (tx): Promise<FirstOwnerOutcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('first-owner', 0))`;
    if ((await tx.staffAssignment.count()) > 0) return "already_one";
    // Numbers are kept as E.164; the command may be given one written any way (a leading "+" names its country).
    const number = toE164("+1", phoneNumber);
    const user =
      number === null
        ? null
        : await tx.user.findUnique({ where: { phoneNumber: number }, select: { id: true } });
    if (user === null) return "no_account";
    await tx.staffAssignment.create({ data: { userId: user.id, role: "owner" } });
    return "granted";
  });
}

export type AttachPhoneOutcome = "attached" | "no_account" | "has_number" | "number_taken" | "bad_number";

/**
 * Gives an account made before sign-in moved to phone numbers (it has an email and no number) its number, so its
 * owner can sign in again and keeps what the account holds: staff role, games, password. Only for an account with no
 * number yet, and only for a number no other account has. The number is not proved by a code here (the command is run
 * with the jobs secret by the Owner), so `phoneConfirmedAt` stays empty; the first code typed at sign-up or reset sets it.
 */
export function attachPhoneToAccount(
  db: PrismaClient,
  email: string,
  phoneNumber: string,
): Promise<AttachPhoneOutcome> {
  const number = toE164("+1", phoneNumber);
  if (number === null) return Promise.resolve("bad_number");
  return db.$transaction(async (tx): Promise<AttachPhoneOutcome> => {
    const user = await tx.user.findFirst({
      where: { email: { equals: email.trim(), mode: "insensitive" } },
      select: { id: true, phoneNumber: true },
    });
    if (user === null) return "no_account";
    if (user.phoneNumber !== null) return "has_number";
    if ((await tx.user.findUnique({ where: { phoneNumber: number }, select: { id: true } })) !== null)
      return "number_taken";
    await tx.user.update({ where: { id: user.id }, data: { phoneNumber: number } });
    return "attached";
  });
}

/** The staff who check games: they accept a game or send it back, and play any game without paying. */
export const GAME_STAFF_ROLES: readonly StaffRole[] = ["owner", "head_curator", "curator"];

/**
 * The oldest staff account that may check games, or null when there is none. The Owner's review command acts as this
 * account, so the command names no person.
 */
export async function firstGameStaff(db: PrismaClient): Promise<string | null> {
  const row = await db.staffAssignment.findFirst({
    where: { role: { in: [...GAME_STAFF_ROLES] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { userId: true },
  });
  return row?.userId ?? null;
}
