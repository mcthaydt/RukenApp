import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { phoneNumber } from "better-auth/plugins";
import { systemClock, type Clock } from "../../lib/clock.ts";
import { runAfterAnswer, type RunInBackground } from "../../lib/server/background.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { mailFailureCode, type Mailer } from "../../lib/server/mail.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { TextError, textFailureCode, type Texter } from "../../lib/server/text.ts";
import { authLimitsPlugin } from "./auth-limits-plugin.ts";
import { resetChannel, resetCodeMessage, userHasMoney } from "./changed-hands.ts";
import { removeAllComputers } from "./computer-keys.ts";
import { WELCOME_BACK_COOKIE, WELCOME_BACK_MAX_AGE_SECONDS, type CookiePolicy } from "./cookies.ts";
import { restoreOnSignIn } from "./deletion.ts";
import { signInPausePlugin } from "./sign-in-pause-plugin.ts";
import { clearSignInFailures } from "./sign-in-guards.ts";
import { alreadyText, passwordChangedText } from "./text-words.ts";

// better-auth at /api/auth, configured to fit the tables in prisma/schema/accounts.prisma:
// - ids come from Prisma's cuid2 defaults (`generateId: false`);
// - rate-limit counters go to the `RateLimit` table (better-auth's database storage).

/** The header that carries the client address into better-auth. Routes always overwrite it. */
export const CLIENT_IP_HEADER = "x-ruken-client-ip";

/**
 * Set by the public /api/auth route (forward.ts) on every request it passes on, overwriting any
 * copy the client sent. Our own forms call better-auth without it, so better-auth can tell a
 * request that came through a form (with its age step, its limits and its checks) from one that
 * came from outside.
 */
export const PUBLIC_ROUTE_HEADER = "x-ruken-public-route";

/**
 * The only /api/auth paths a request from outside may reach. Every form calls better-auth on the server, without the
 * header above, so nothing else needs to be public. The phone plugin's `verify` above all must stay out of reach: it
 * signs in whoever holds a code, so a code for a number that already has an account (a number that changed hands,
 * say) would open that account. Our own form calls it only when no account has the number (forms.ts).
 */
export const PUBLIC_AUTH_PATHS: readonly string[] = ["/ok", "/get-session", "/sign-out"];

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const ONE_DAY_SECONDS = 60 * 60 * 24;
const TEN_MINUTES_SECONDS = 10 * 60;
const PASSWORD_LENGTHS = { min: 10, max: 128 };

export interface AuthOptions {
  prisma: PrismaClient;
  /** BETTER_AUTH_SECRET: signs session cookies. */
  secret: string;
  /** BETTER_AUTH_URL: the site's own origin, e.g. https://ruken.example. */
  baseURL: string;
  /** Sends the one mail left: a reset code to the email a member pays with. */
  mailer: Mailer;
  /** Sends every text: codes through Twilio Verify, notices through Ruken's own numbers. */
  texter: Texter;
  cookies: CookiePolicy;
  /** Time for the rules that count recent events. Defaults to the system clock. */
  clock?: Clock;
  /** Where a text or mail that could not be sent is reported. Gets no number or address. Defaults to one console line. */
  log?: (message: string) => void;
  /** Where texts and mail sent after the answer run. Defaults to the host's `waitUntil` (background.ts). */
  runInBackground?: RunInBackground;
}

export function createAuth(options: AuthOptions) {
  const { prisma, mailer, texter, cookies } = options;
  const clock = options.clock ?? systemClock;
  const log =
    options.log ??
    ((message: string): void => {
      console.warn(message);
    });
  const runInBackground: RunInBackground = options.runInBackground ?? runAfterAnswer;
  const cookiePrefix = cookies.secure ? "__Host-" : "";
  // The sign-in pause and the per-number limits key their rows by a hash of the number made with
  // this secret, so a copy of the database does not show which numbers were tried (phone.ts, hashNumber).
  const guards = { db: prisma, clock, secret: options.secret };

  /**
   * Sends a text or a mail after the answer. Why not wait for it: only real accounts get one, so an answer
   * that waited for Twilio or the mail server would come back measurably later for a number with an account,
   * and the form would tell a stranger who has one. A failed send is logged by its code only, never
   * the error's message, which can hold the number or address (textFailureCode, mailFailureCode).
   */
  function sendLater(
    what: string,
    send: () => Promise<unknown>,
    failureCode: (error: unknown) => string,
  ): void {
    runInBackground(async () => {
      try {
        await send();
      } catch (error) {
        log(`${what} not sent: ${failureCode(error)}`);
      }
    });
  }
  const textLater = (what: string, send: () => Promise<unknown>): void => {
    sendLater(what, send, textFailureCode);
  };

  /**
   * A sign-up code. A number nobody has gets the code, through Twilio Verify. A number that already has an account
   * gets no code at all (a code that could never work would be worse than none) and one text that says so instead;
   * the form asks for both the same way, so the answer, its time and its limits are the same (audit 6). Until the
   * carriers approve Ruken's numbers that text does not reach a real United States phone, and the code screen's "No
   * text?" line is what the person has.
   */
  async function sendSignUpCode(number: string, code: string): Promise<void> {
    const account = await prisma.user.findUnique({ where: { phoneNumber: number }, select: { id: true } });
    if (account === null) {
      await texter.sendCode(number, code);
    } else {
      await texter.send({ to: number, line: "account", body: alreadyText(options.baseURL) });
    }
  }

  /** A reset code: by text, to the email the member pays with, or held for help (changed-hands.ts). */
  async function sendResetCode(number: string, code: string): Promise<void> {
    const account = await prisma.user.findUnique({
      where: { phoneNumber: number },
      select: { id: true, phoneNumber: true, paperEmail: true },
    });
    if (account?.phoneNumber == null) return;
    const channel = await resetChannel(
      { db: prisma, texter, hasMoney: userHasMoney },
      { id: account.id, phoneNumber: account.phoneNumber, paperEmail: account.paperEmail },
    );
    if (channel === "text") {
      await texter.sendCode(number, code);
    } else if (channel === "email" && account.paperEmail !== null) {
      await mailer.send(resetCodeMessage(account.paperEmail, code));
    } else {
      // The number may have changed hands and there is no email to send to. No number in the line.
      log("reset held for help");
    }
  }

  return betterAuth({
    appName: "Ruken",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    // Only our own origin may call the auth endpoints with cookies (CSRF protection), and only paths
    // on it are accepted as a `callbackURL`.
    trustedOrigins: [new URL(options.baseURL).origin],
    telemetry: { enabled: false },

    // Codes are kept as plain text in `Verification.value` for ten minutes: the phone plugin has no option to hash
    // them. A code works for ten minutes and allows three tries, and a copy of the table is a copy of codes that have
    // mostly run out already.

    // Email sign-up and sign-in are not offered: a person is their phone number. better-auth still reads this block
    // for its password rules and for what happens after a forgot-password reset.
    emailAndPassword: {
      enabled: false,
      minPasswordLength: PASSWORD_LENGTHS.min,
      maxPasswordLength: PASSWORD_LENGTHS.max,
      // A reset signs every device out, and does not sign anyone in.
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }) => {
        // better-auth calls this after saving the new password and before it signs every device out,
        // and an error thrown here would skip the signing out (and answer 500, though the password
        // did change). So nothing here may throw: a stolen session must not outlive the reset
        // because Twilio or the database hiccuped.
        // A reset also ends every computer's key, on its own try so a failure here never stops the signing out.
        try {
          await removeAllComputers(prisma, user.id);
        } catch (error) {
          log(
            `computer keys not removed after a reset: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        }
        const number = (user as { phoneNumber?: string | null }).phoneNumber;
        if (number == null) return;
        try {
          // A finished reset lifts the sign-in pause: the person has just proved they hold the number.
          await clearSignInFailures(guards, number);
        } catch (error) {
          log(
            `sign-in pause not lifted after a reset: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        }
        textLater("password changed notice", () =>
          texter.send({ to: number, line: "account", body: passwordChangedText(options.baseURL) }),
        );
      },
    },

    user: {
      additionalFields: {
        // Read so the request hook can treat an account that is waiting to be deleted, or gone, as
        // signed out (sessionInfo). Never set by a request. Without this field every account would
        // read as not `active`, and everyone would be signed out.
        status: { type: "string", required: false, input: false },
      },
    },

    session: {
      expiresIn: THIRTY_DAYS_SECONDS,
      updateAge: ONE_DAY_SECONDS,
      // No cookie cache: every request checks the Session row, so signing out or revoking a
      // session takes effect at once.
      cookieCache: { enabled: false },
    },

    rateLimit: {
      enabled: true,
      storage: "database",
      // Per client address (better-auth keys every rule by IP and path). Paths are relative to
      // /api/auth. The limits that count per number are in auth-limits-plugin.ts.
      // Keep every window under a day: RATE_LIMIT_ROWS_KEPT_MS in rate-limit.ts.
      customRules: {
        // The per-number plugin allows 5 a minute for one number from one client. This wider
        // per-client backstop still stops one client trying many numbers quickly, while people
        // behind one shared address (a campus, a mobile carrier) do not lock each other out.
        "/sign-in/phone-number": { window: 60, max: 30 },
        // A client's sign-up starts, which cost a text each.
        "/phone-number/send-otp": { window: 60 * 60, max: 5 },
        "/phone-number/request-password-reset": { window: 60 * 60, max: 10 },
        // The phone plugin brings its own limit for every /phone-number path (10 a minute per client) and applies it
        // wherever no rule is named here, counting requests from outside that are answered 404. Switched off for
        // `verify`, so that posts from outside cannot make the sign-up code read differently for a number with an
        // account (which never goes through `verify`) and one without.
        "/phone-number/verify": false,
        // Keep it to what a person retyping a password needs. The sign-up code has no rule here: the sign-up form
        // counts every code typed per client itself (forms.ts), so a number with an account and one without are
        // refused at the same try.
        "/phone-number/reset-password": { window: 15 * 60, max: 10 },
        // The password change on the account page checks the current password first (credentials.ts, with the
        // per-number limits); this is the per-client backstop under it.
        "/change-password": { window: 15 * 60, max: 10 },
      },
    },

    advanced: {
      database: { generateId: false },
      // Our cookie names are exact (cookies.ts), so better-auth must not add its own __Secure- prefix.
      useSecureCookies: false,
      cookies: {
        session_token: { name: cookies.sessionCookieName },
        session_data: { name: `${cookiePrefix}rk_session_data` },
        dont_remember: { name: `${cookiePrefix}rk_dont_remember` },
        account_data: { name: `${cookiePrefix}rk_account_data` },
      },
      defaultCookieAttributes: { secure: cookies.secure, httpOnly: true, sameSite: "lax", path: "/" },
      // The route copies SvelteKit's getClientAddress() into this header and drops any copy
      // the client sent, so a visitor cannot pick their own rate-limit bucket.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },

    plugins: [
      // The limits that count per phone number. First, so a refused request does not use up one of
      // the number's ten password guesses.
      authLimitsPlugin({
        limiter: createRateLimiter(prisma, clock),
        secret: options.secret,
        clientIpHeader: CLIENT_IP_HEADER,
      }),
      // Ten wrong passwords for one number pause password sign-in for that number for an hour.
      signInPausePlugin({ guards, prisma, texter, siteUrl: options.baseURL, log, runInBackground }),
      // better-auth makes and checks every code (six digits, ten minutes, three tries); Twilio Verify only carries it.
      // `sendOTP` and `sendPasswordResetOTP` hand the send on and return at once.
      phoneNumber({
        otpLength: 6,
        expiresIn: TEN_MINUTES_SECONDS,
        allowedAttempts: 3,
        phoneNumberValidator: (number) => /^\+[0-9]{8,15}$/.test(number),
        sendOTP: ({ phoneNumber: number, code }) => {
          textLater("sign-up code", () => sendSignUpCode(number, code));
          return Promise.resolve();
        },
        sendPasswordResetOTP: ({ phoneNumber: number, code }) => {
          sendLater(
            "reset code",
            () => sendResetCode(number, code),
            // A text's failure is logged by its Twilio code, a mail's by its own; neither holds the number or address.
            (error) => (error instanceof TextError ? textFailureCode(error) : mailFailureCode(error)),
          );
          return Promise.resolve();
        },
        signUpOnVerification: {
          // better-auth cannot make a user without an email, so each gets one that can never be real (`.invalid`,
          // RFC 2606) and that nothing mails.
          getTempEmail: () => `${crypto.randomUUID()}@phone.ruken.invalid`,
          getTempName: () => "Player",
        },
      }),
    ],

    hooks: {
      // Everything else is for our own forms, which call better-auth on the server without the public-route header.
      before: createAuthMiddleware((ctx) => {
        if (ctx.headers?.get(PUBLIC_ROUTE_HEADER) == null) return Promise.resolve();
        if (!PUBLIC_AUTH_PATHS.includes(ctx.path)) throw new APIError("NOT_FOUND");
        return Promise.resolve();
      }),
    },

    databaseHooks: {
      session: {
        create: {
          // Signing in within 14 days of asking to delete the account undoes it. The next page then says "Welcome
          // back" once, through a short-lived flag cookie that only the server reads (src/routes/+layout.server.ts).
          // After the 14 days nothing is restored and the account stays signed out (handle.ts).
          after: async (session, context) => {
            if (await restoreOnSignIn(prisma, clock, session.userId)) {
              context?.setCookie(WELCOME_BACK_COOKIE, "1", {
                path: "/",
                maxAge: WELCOME_BACK_MAX_AGE_SECONDS,
                sameSite: "lax",
                secure: cookies.secure,
                httpOnly: true,
              });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** What the request hook needs from a signed-in session. */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  /** `User.status`. Only an `active` account counts as signed in. */
  userStatus: string;
  /** The refreshed session cookie better-auth sent back, to copy onto the response. */
  setCookies?: string[];
}

/**
 * The signed-in session for these request headers, in the shape the hook needs, or null.
 *
 * Once a session is a day old (`updateAge`), better-auth extends it by 30 days and answers with a
 * new session cookie. `returnHeaders` keeps that Set-Cookie line instead of dropping it, and the
 * hook copies it onto the page (30 days, rolling). Without it the browser would forget the cookie
 * 30 days after sign-in while the database row lived on.
 */
export async function sessionInfo(auth: Auth, headers: Headers): Promise<SessionInfo | null> {
  const { headers: answer, response: result } = await auth.api.getSession({ headers, returnHeaders: true });
  if (result === null) return null;
  const setCookies = answer.getSetCookie();
  return {
    sessionId: result.session.id,
    userId: result.user.id,
    userStatus: result.user.status ?? "",
    ...(setCookies.length === 0 ? {} : { setCookies }),
  };
}
