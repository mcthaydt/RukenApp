import { createHmac } from "node:crypto";
import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { hashNumber } from "./phone.ts";

// A sign-up between its two screens: the password (hashed by better-auth) and the 18th birthday wait here for the
// code. A row belongs to the browser that started the sign-up (`browser`, a random value that browser keeps in a
// cookie), so a code typed in one browser finishes only that browser's sign-up.
//
// Why a row for each browser and not one for each number: a stranger who knows someone's number could start a sign-up
// after them, replace the kept password with their own, and have the real person's code put the stranger's password
// on the new account. With a row for each browser, the stranger's try adds a row and replaces none, and the real
// person's code finishes the real person's sign-up.
//
// Both keys are keyed hashes under the server's secret, so a copy of the table shows no number and no browser value,
// and nothing readable is kept for a number that never finishes. Rows last ten minutes, as the code does.

export const PENDING_MS = 10 * 60 * 1000;

export interface PendingDeps {
  db: PrismaClient;
  clock: Clock;
  /** BETTER_AUTH_SECRET, the key for both hashes. */
  secret: string;
}

export interface PendingSignUp {
  passwordHash: string;
  adultOn: Date;
}

/** A browser's own value for its sign-up: 32 random bytes, in base64url. The browser keeps it in a cookie. */
export function newBrowserValue(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

function hashBrowser(browser: string, secret: string): string {
  return createHmac("sha256", secret).update(`sign-up:${browser}`).digest("hex");
}

/** Keeps this browser's sign-up for the number, replacing what the same browser kept before. */
export async function keepPending(
  deps: PendingDeps,
  input: { number: string; browser: string; passwordHash: string; adultOn: Date },
): Promise<void> {
  const numberHash = hashNumber(input.number, deps.secret);
  const browserHash = hashBrowser(input.browser, deps.secret);
  const expiresAt = new Date(deps.clock.epochMs() + PENDING_MS);
  await deps.db.pendingSignUp.upsert({
    where: { numberHash_browserHash: { numberHash, browserHash } },
    create: { numberHash, browserHash, passwordHash: input.passwordHash, adultOn: input.adultOn, expiresAt },
    update: { passwordHash: input.passwordHash, adultOn: input.adultOn, expiresAt },
  });
}

/**
 * What this browser kept for the number, or null when it kept nothing, the row is another browser's, or it has run
 * out (an expired row is deleted here). The row stays: a sign-up whose last step fails is tried again.
 */
export async function takePending(
  deps: PendingDeps,
  input: { number: string; browser: string },
): Promise<PendingSignUp | null> {
  if (input.browser === "") return null;
  const numberHash = hashNumber(input.number, deps.secret);
  const browserHash = hashBrowser(input.browser, deps.secret);
  const row = await deps.db.pendingSignUp.findUnique({
    where: { numberHash_browserHash: { numberHash, browserHash } },
  });
  if (row === null) return null;
  if (row.expiresAt.getTime() <= deps.clock.epochMs()) {
    await deps.db.pendingSignUp.deleteMany({ where: { numberHash, browserHash } });
    return null;
  }
  return { passwordHash: row.passwordHash, adultOn: row.adultOn };
}

/** Deletes every browser's kept sign-up for the number: the number now has an account. Takes a transaction as well. */
export async function forgetPending(
  deps: { db: Pick<PrismaClient, "pendingSignUp">; secret: string },
  number: string,
): Promise<void> {
  await deps.db.pendingSignUp.deleteMany({ where: { numberHash: hashNumber(number, deps.secret) } });
}
