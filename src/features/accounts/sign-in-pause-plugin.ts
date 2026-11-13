import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import type { RunInBackground } from "../../lib/server/background.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { mailFailureCode, type Mailer } from "../../lib/server/mail.ts";
import { signInPausedMessage } from "./mails.ts";
import {
  clearSignInFailures,
  recordWrongPassword,
  releaseSignInAttempt,
  reserveSignInAttempt,
  type SignInGuards,
} from "./sign-in-guards.ts";

// The account-level pause on password sign-in: at most ten password guesses for one email address
// inside an hour, and a wrong tenth pauses password sign-in for that address for an hour. The rules
// and the table are in sign-in-guards.ts; this plugin is the glue to better-auth's /sign-in/email:
// - the "before" hook reserves the guess before better-auth checks the password, and refuses once
//   the address is paused or its ten guesses are used up. Reserving first, in one statement, is
//   what stops a burst of requests from many client addresses getting more than ten guesses;
// - the "after" hook settles the guess by the answer: a sign-in forgives everything, a 401 counts
//   as a wrong password (and may start the pause), anything else was not a guess and is given back.
//
// Nothing here may tell a stranger whether an address has an account: guesses are counted for any
// address typed in, and an address with no account is paused the same way and answered with the
// same words. When a pause starts for an address that does have an account, its owner is mailed a
// notice. The mail is sent after the answer is decided and is not waited for, so neither the status
// nor the time of the answer says whether the address has an account.
//
// The password reset is not paused: it is how a person who is locked out gets back in. (It also
// means someone can pause another person's password sign-in on purpose. That costs the victim a
// reset, and is the usual trade.)

/** The error code (and its words) better-auth answers with while password sign-in is paused. */
export const SIGN_IN_PAUSED = "SIGN_IN_PAUSED";
export const SIGN_IN_PAUSED_MESSAGE =
  "Too many tries. Sign-in is paused for an hour for this email. You can reset your password now.";

const SIGN_IN_PATH = "/sign-in/email";

export interface SignInPauseOptions {
  guards: SignInGuards;
  prisma: PrismaClient;
  mailer: Mailer;
  /** Called with a line of text when the notice mail could not be sent. Gets no address. */
  log: (message: string) => void;
  runInBackground: RunInBackground;
}

/** The address a sign-in request names, or undefined when the body has none (the endpoint's own checks refuse that). */
function emailOf(body: unknown): string | undefined {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.trim() !== "" ? email : undefined;
}

export function signInPausePlugin(options: SignInPauseOptions): BetterAuthPlugin {
  const { guards, prisma, mailer, log, runInBackground } = options;

  /** Tells the account's owner their password sign-in is paused. Never throws: it runs after the answer is decided. */
  async function sendPauseNotice(email: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { email: true },
      });
      if (user === null) return;
      await mailer.send(signInPausedMessage(user.email));
    } catch (error) {
      log(`sign-in pause notice not sent: ${mailFailureCode(error)}`);
    }
  }

  return {
    id: "sign-in-pause",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const email = emailOf(ctx.body);
            if (email === undefined) return;
            // Even the right password is refused while paused, or ten guesses would still find it.
            const { allowed } = await reserveSignInAttempt(guards, email);
            if (!allowed) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message: SIGN_IN_PAUSED_MESSAGE,
                code: SIGN_IN_PAUSED,
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const email = emailOf(ctx.body);
            const returned = ctx.context.returned;
            if (email === undefined || returned === undefined) return;

            if (!isAPIError(returned)) {
              // The password was right: whatever was counted before is forgiven.
              await clearSignInFailures(guards, email);
              return;
            }
            // 401 is better-auth's answer for a wrong password and for an unknown address alike. Other
            // errors (a bad body, a server error) are not guesses, so the reserved guess goes back.
            // Our own refusal never gets here: an error thrown by a "before" hook skips the "after" hooks.
            if (returned.statusCode !== 401) {
              await releaseSignInAttempt(guards, email);
              return;
            }
            const { pauseStarted } = await recordWrongPassword(guards, email);
            if (pauseStarted) runInBackground(() => sendPauseNotice(email));
          }),
        },
      ],
    },
  };
}
