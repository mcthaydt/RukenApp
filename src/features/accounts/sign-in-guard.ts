// The account-level pause after too many wrong passwords. The limits and the key are here;
// sign-in-guards.ts keeps the counts in the SignInGuard table.
//
// The pause is per phone number and not per account, on purpose. Counting guesses only for real
// accounts would let anyone find out which numbers have one: a real number would start
// refusing, an invented one never would. So any number typed into the sign-in form is counted,
// under a keyed hash of it (`hashNumber`, phone.ts), and a number with no account gets paused the same way.
//
// Windows are fixed, not sliding: the first guess opens a one-hour window, at most ten guesses are
// let through inside it, and a wrong tenth pauses password sign-in for an hour. That is simple to
// reason about, and good enough for a limit of ten.

/** Guesses let through inside one window. A wrong one at the limit pauses the number. */
export const SIGN_IN_FAILURE_LIMIT = 10;
export const SIGN_IN_WINDOW_MS = 60 * 60 * 1000;
export const SIGN_IN_PAUSE_MS = 60 * 60 * 1000;

/** What is kept for one number: the same fields as a SignInGuard row. */
export interface SignInGuardState {
  /** Guesses counted in this window, including any refused once the limit was reached. */
  failures: number;
  windowStartedAt: Date;
  /** Set when a wrong guess arrives at the limit. Password sign-in is refused until this moment. */
  pausedUntil: Date | null;
}

/** Whether password sign-in is refused for this number right now. A pause that has ended no longer counts. */
export function isSignInPaused(state: SignInGuardState | null, now: Date): boolean {
  return state?.pausedUntil != null && state.pausedUntil.getTime() > now.getTime();
}
