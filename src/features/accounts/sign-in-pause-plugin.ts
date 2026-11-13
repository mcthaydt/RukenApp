import type { BetterAuthPlugin } from "better-auth";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { RunInBackground } from "../../lib/server/background.ts";
import type { Mailer } from "../../lib/server/mail.ts";
import type { SignInGuards } from "./sign-in-guards.ts";

/** The error code (and its words) better-auth answers with while password sign-in is paused. */
export const SIGN_IN_PAUSED = "SIGN_IN_PAUSED";
export const SIGN_IN_PAUSED_MESSAGE =
  "Password sign-in is paused for this email for a while. Reset your password, or try again in an hour.";

export interface SignInPauseOptions {
  guards: SignInGuards;
  prisma: PrismaClient;
  mailer: Mailer;
  /** Called with a line of text when the notice mail could not be sent. Gets no address. */
  log: (message: string) => void;
  runInBackground: RunInBackground;
}

export function signInPausePlugin(options: SignInPauseOptions): BetterAuthPlugin {
  throw new Error(`not built yet (${typeof options})`);
}
