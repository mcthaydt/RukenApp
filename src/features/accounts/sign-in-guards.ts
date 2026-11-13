import type { Clock } from "../../lib/clock.ts";
import type { PrismaClient } from "../../lib/server/db.ts";

/** What every function here needs. `secret` is BETTER_AUTH_SECRET, the key for the address hash. */
export interface SignInGuards {
  db: PrismaClient;
  clock: Clock;
  secret: string;
}

export function isSignInPausedFor(guards: SignInGuards, email: string): Promise<boolean> {
  throw new Error(`not built yet (${typeof guards} ${email})`);
}

export function reserveSignInAttempt(guards: SignInGuards, email: string): Promise<{ allowed: boolean }> {
  throw new Error(`not built yet (${typeof guards} ${email})`);
}

export function recordWrongPassword(guards: SignInGuards, email: string): Promise<{ pauseStarted: boolean }> {
  throw new Error(`not built yet (${typeof guards} ${email})`);
}

export function releaseSignInAttempt(guards: SignInGuards, email: string): Promise<void> {
  throw new Error(`not built yet (${typeof guards} ${email})`);
}

export function clearSignInFailures(
  guards: Pick<SignInGuards, "db" | "secret">,
  email: string,
): Promise<void> {
  throw new Error(`not built yet (${typeof guards} ${email})`);
}
