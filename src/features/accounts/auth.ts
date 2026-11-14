import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { systemClock, type Clock } from "../../lib/clock.ts";
import { runAfterAnswer, type RunInBackground } from "../../lib/server/background.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import { mailFailureCode, type Mailer } from "../../lib/server/mail.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { authLimitsPlugin } from "./auth-limits-plugin.ts";
import { WELCOME_BACK_COOKIE, WELCOME_BACK_MAX_AGE_SECONDS, type CookiePolicy } from "./cookies.ts";
import { restoreOnSignIn } from "./deletion.ts";
import { passwordChangedMessage, passwordResetMessage, verificationMessage } from "./mails.ts";
import { signInPausePlugin } from "./sign-in-pause-plugin.ts";
import { clearSignInFailures } from "./sign-in-guards.ts";

// better-auth at /api/auth, configured to fit the tables in prisma/schema/accounts.prisma:
// - ids come from Prisma's cuid2 defaults (`generateId: false`);
// - rate-limit counters go to the `RateLimit` table (better-auth's database storage).

/** The header that carries the client address into better-auth. Routes always overwrite it. */
export const CLIENT_IP_HEADER = "x-ruken-client-ip";

/**
 * Set by the public /api/auth route (forward.ts) on every request it passes on, overwriting any
 * copy the client sent. The sign-up form's action calls better-auth without it, so better-auth can
 * tell a sign-up that came through the form (with its age step) from one that did not.
 */
export const PUBLIC_ROUTE_HEADER = "x-ruken-public-route";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;
const ONE_DAY_SECONDS = 60 * 60 * 24;
const ONE_HOUR_SECONDS = 60 * 60;
const PASSWORD_LENGTHS = { min: 10, max: 128 };

export interface AuthOptions {
  prisma: PrismaClient;
  /** BETTER_AUTH_SECRET: signs session cookies. */
  secret: string;
  /** BETTER_AUTH_URL: the site's own origin, e.g. https://ruken.example. */
  baseURL: string;
  mailer: Mailer;
  cookies: CookiePolicy;
  /** Time for the rules that count recent events. Defaults to the system clock. */
  clock?: Clock;
  /** Where a mail that could not be sent is reported. Gets no address. Defaults to one console line. */
  log?: (message: string) => void;
  /** Where mail sent after the answer runs. Defaults to the host's `waitUntil` (background.ts). */
  runInBackground?: RunInBackground;
}

export function createAuth(options: AuthOptions) {
  const { prisma, mailer, cookies } = options;
  const clock = options.clock ?? systemClock;
  const log =
    options.log ??
    ((message: string): void => {
      console.warn(message);
    });
  const runInBackground: RunInBackground = options.runInBackground ?? runAfterAnswer;
  const cookiePrefix = cookies.secure ? "__Host-" : "";
  // The sign-in pause and the per-address limits key their rows by a hash of the address made with
  // this secret, so a copy of the database does not show which addresses were tried (sign-in-guard.ts).
  const guards = { db: prisma, clock, secret: options.secret };

  /**
   * Sends a mail after the answer. Why not wait for it: only real accounts get mail, so an answer
   * that waited for the mail server would come back measurably later for an address with an account,
   * and the form would tell a stranger who has one. A failed send is logged by its code only, never
   * the error's message, which can hold the address (mailFailureCode).
   */
  function mailLater(what: string, send: () => Promise<unknown>): void {
    runInBackground(async () => {
      try {
        await send();
      } catch (error) {
        log(`${what} not sent: ${mailFailureCode(error)}`);
      }
    });
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

    // A reset link's token is stored only as its SHA-256: a copy of the database holds nothing that
    // can reset a password. better-auth hashes the identifier the same way when it looks the token up.
    verification: { storeIdentifier: { default: "plain", overrides: { "reset-password:": "hashed" } } },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_LENGTHS.min,
      maxPasswordLength: PASSWORD_LENGTHS.max,
      autoSignIn: true,

      // A forgotten password is reset from a mailed link, on our /reset-password page. The request
      // answers the same whether or not the address has an account (better-auth does that); only
      // real accounts get mail, sent after the answer (mailLater). How often one address may ask is
      // the per-address limit in auth-limits-plugin.ts, counted for any address typed in.
      // A reset signs every device out, and does not sign anyone in.
      resetPasswordTokenExpiresIn: ONE_HOUR_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) => {
        mailLater("password reset mail", () => mailer.send(passwordResetMessage(user.email, url)));
        return Promise.resolve();
      },
      onPasswordReset: async ({ user }) => {
        // better-auth calls this after saving the new password and before it signs every device out,
        // and an error thrown here would skip the signing out (and answer 500, though the password
        // did change). So nothing here may throw: a stolen session must not outlive the reset
        // because a mail server or the database hiccuped.
        try {
          // A finished reset lifts the sign-in pause: the person has just proved they own the address.
          await clearSignInFailures(guards, user.email);
        } catch (error) {
          log(
            `sign-in pause not lifted after a reset: ${error instanceof Error ? error.message : "unknown error"}`,
          );
        }
        mailLater("password changed notice", () => mailer.send(passwordChangedMessage(user.email)));
      },
    },

    // Sign-up mails a link that confirms the address. Using the site never waits for it; /me shows
    // whether the email is confirmed and offers to resend.
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: ONE_DAY_SECONDS,
      // Waited for, unlike the mails above: sign-up already says the account is new. A failure is
      // logged here by its code, because better-auth would log the raw error, which can hold the
      // address; better-auth ignores the failure either way.
      sendVerificationEmail: async ({ user, url }) => {
        try {
          await mailer.send(verificationMessage(user.email, url));
        } catch (error) {
          log(`email confirmation mail not sent: ${mailFailureCode(error)}`);
        }
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
      // /api/auth. The limits that count per email address are in auth-limits-plugin.ts.
      // Keep every window under a day: RATE_LIMIT_ROWS_KEPT_MS in rate-limit.ts.
      customRules: {
        // The per-address plugin allows 5 a minute for one address from one client. This wider
        // per-client backstop still stops one client trying many addresses quickly, while people
        // behind one shared address (a campus, a mobile carrier) do not lock each other out.
        "/sign-in/email": { window: 60, max: 30 },
        "/sign-up/email": { window: 60 * 60, max: 5 },
        "/request-password-reset": { window: 60 * 60, max: 10 },
        "/send-verification-email": { window: 15 * 60, max: 3 },
        // Keep it to what a person retyping a password needs.
        "/reset-password": { window: 15 * 60, max: 10 },
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
      // The limits that count per email address. First, so a refused request does not use up one of
      // the address's ten password guesses.
      authLimitsPlugin({
        limiter: createRateLimiter(prisma, clock),
        secret: options.secret,
        clientIpHeader: CLIENT_IP_HEADER,
      }),
      // Ten wrong passwords for one address pause password sign-in for that address for an hour.
      signInPausePlugin({ guards, prisma, mailer, log, runInBackground }),
    ],

    hooks: {
      // Accounts are made only by the sign-up page, which asks the age first. Its action calls
      // better-auth on the server, so an email sign-up reached through the public route is refused
      // as if it did not exist.
      before: createAuthMiddleware((ctx) => {
        if (ctx.headers?.get(PUBLIC_ROUTE_HEADER) == null) return Promise.resolve();
        if (ctx.path === "/sign-up/email") throw new APIError("NOT_FOUND");
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
