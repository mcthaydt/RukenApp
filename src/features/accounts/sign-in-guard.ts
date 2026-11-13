import { createHmac } from "node:crypto";

// The account-level pause after too many wrong passwords. The limits and the key are here;
// sign-in-guards.ts keeps the counts in the SignInGuard table.
//
// The pause is per email address and not per account, on purpose. Counting guesses only for real
// accounts would let anyone find out which addresses have one: a real address would start
// refusing, an invented one never would. So any address typed into the sign-in form is counted,
// under a keyed hash of it, and an address with no account gets paused the same way.
//
// Windows are fixed, not sliding: the first guess opens a one-hour window, at most ten guesses are
// let through inside it, and a wrong tenth pauses password sign-in for an hour. That is simple to
// reason about, and good enough for a limit of ten.

/** Guesses let through inside one window. A wrong one at the limit pauses the address. */
export const SIGN_IN_FAILURE_LIMIT = 10;
export const SIGN_IN_WINDOW_MS = 60 * 60 * 1000;
export const SIGN_IN_PAUSE_MS = 60 * 60 * 1000;

/** What is kept for one address: the same fields as a SignInGuard row. */
export interface SignInGuardState {
  /** Guesses counted in this window, including any refused once the limit was reached. */
  failures: number;
  windowStartedAt: Date;
  /** Set when a wrong guess arrives at the limit. Password sign-in is refused until this moment. */
  pausedUntil: Date | null;
}

/**
 * The key for an address: HMAC-SHA-256 of the trimmed, lower-cased address under the server's
 * secret (BETTER_AUTH_SECRET), in lower-case hex (the table's check requires that shape).
 *
 * Why keyed and not a plain SHA-256: email addresses are easy to guess, so anyone holding a copy of
 * the table (a backup, a replica) could hash a list of addresses and see which were typed into
 * sign-in. Without the secret they cannot. The fixed "sign-in-guard" prefix keeps these values
 * apart from anything else that might one day be derived from the same secret.
 *
 * Changing the secret makes every existing row unreachable; at worst that lifts current pauses
 * early. A row whose window and pause are over is overwritten by the next failure, so nothing else
 * is needed to keep the table right.
 */
export function hashSignInEmail(email: string, secret: string): string {
  return createHmac("sha256", secret).update(`sign-in-guard:${email.trim().toLowerCase()}`).digest("hex");
}

/** Whether password sign-in is refused for this address right now. A pause that has ended no longer counts. */
export function isSignInPaused(state: SignInGuardState | null, now: Date): boolean {
  return state?.pausedUntil != null && state.pausedUntil.getTime() > now.getTime();
}
