/** Guesses let through inside one window. A wrong one at the limit pauses the address. */
export const SIGN_IN_FAILURE_LIMIT = 10;
export const SIGN_IN_WINDOW_MS = 60 * 60 * 1000;
export const SIGN_IN_PAUSE_MS = 60 * 60 * 1000;

/** What is kept for one address: the same fields as a SignInGuard row. */
export interface SignInGuardState {
  failures: number;
  windowStartedAt: Date;
  pausedUntil: Date | null;
}

export function hashSignInEmail(email: string, secret: string): string {
  throw new Error(`not built yet (${email} ${secret})`);
}

export function isSignInPaused(state: SignInGuardState | null, now: Date): boolean {
  throw new Error(`not built yet (${typeof state} ${now.toISOString()})`);
}
