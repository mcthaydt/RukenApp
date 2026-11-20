import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import type { RunInBackground } from "../../lib/server/background.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { textFailureCode, type Texter } from "../../lib/server/text.ts";
import {
  clearSignInFailures,
  recordWrongPassword,
  releaseSignInAttempt,
  reserveSignInAttempt,
  type SignInGuards,
} from "./sign-in-guards.ts";
import { signInPausedText } from "./text-words.ts";

// The account-level pause on password sign-in: at most ten password guesses for one phone number
// inside an hour, and a wrong tenth pauses password sign-in for that number for an hour. The rules
// and the table are in sign-in-guards.ts; this plugin is the glue to better-auth's /sign-in/phone-number:
// - the "before" hook reserves the guess before better-auth checks the password, and refuses once
//   the address is paused or its ten guesses are used up. Reserving first, in one statement, is
//   what stops a burst of requests from many client addresses getting more than ten guesses;
// - the "after" hook settles the guess by the answer: a sign-in forgives everything, a 401 counts
//   as a wrong password (and may start the pause), anything else was not a guess and is given back.
//
// Nothing here may tell a stranger whether a number has an account: guesses are counted for any
// number typed in, and a number with no account is paused the same way and answered with the
// same words. When a pause starts for a number that does have an account, its owner is texted a
// notice. The text is sent after the answer is decided and is not waited for, so neither the status
// nor the time of the answer says whether the number has an account.
//
// The password reset is not paused: it is how a person who is locked out gets back in. (It also
// means someone can pause another person's password sign-in on purpose. That costs the victim a
// reset, and is the usual trade.)
//
// Until the carriers approve Ruken's numbers (plan step X5) the notice does not reach a real United States phone;
// the pause itself works either way, and the sign-in screen says so.

/** The error code (and its words) better-auth answers with while password sign-in is paused. */
export const SIGN_IN_PAUSED = "SIGN_IN_PAUSED";
export const SIGN_IN_PAUSED_MESSAGE =
  "Too many tries. Sign-in is paused for an hour for this number. You can reset your password now.";

const SIGN_IN_PATH = "/sign-in/phone-number";

export interface SignInPauseOptions {
  guards: SignInGuards;
  prisma: PrismaClient;
  texter: Texter;
  /** BETTER_AUTH_URL: the address the notice's link points at. */
  siteUrl: string;
  /** Called with a line of text when the notice could not be sent. Gets no number. */
  log: (message: string) => void;
  runInBackground: RunInBackground;
}

/** The number a sign-in request names, or undefined when the body has none (the endpoint's own checks refuse that). */
function numberOf(body: unknown): string | undefined {
  const number = (body as { phoneNumber?: unknown } | undefined)?.phoneNumber;
  return typeof number === "string" && number.trim() !== "" ? number : undefined;
}

export function signInPausePlugin(options: SignInPauseOptions): BetterAuthPlugin {
  const { guards, prisma, texter, siteUrl, log, runInBackground } = options;

  /** Tells the account's owner their password sign-in is paused. Never throws: it runs after the answer is decided. */
  async function sendPauseNotice(number: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { phoneNumber: number },
        select: { phoneNumber: true },
      });
      if (user?.phoneNumber == null) return;
      await texter.send({ to: user.phoneNumber, line: "account", body: signInPausedText(siteUrl) });
    } catch (error) {
      log(`sign-in pause notice not sent: ${textFailureCode(error)}`);
    }
  }

  return {
    id: "sign-in-pause",
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const number = numberOf(ctx.body);
            if (number === undefined) return;
            // Even the right password is refused while paused, or ten guesses would still find it.
            const { allowed } = await reserveSignInAttempt(guards, number);
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
            const number = numberOf(ctx.body);
            const returned = ctx.context.returned;
            if (number === undefined || returned === undefined) return;

            if (!isAPIError(returned)) {
              // The password was right: whatever was counted before is forgiven.
              await clearSignInFailures(guards, number);
              return;
            }
            // 401 is better-auth's answer for a wrong password and for an unknown number alike. Other
            // errors (a bad body, a server error) are not guesses, so the reserved guess goes back.
            // Our own refusal never gets here: an error thrown by a "before" hook skips the "after" hooks.
            if (returned.statusCode !== 401) {
              await releaseSignInAttempt(guards, number);
              return;
            }
            const { pauseStarted } = await recordWrongPassword(guards, number);
            if (pauseStarted) runInBackground(() => sendPauseNotice(number));
          }),
        },
      ],
    },
  };
}
