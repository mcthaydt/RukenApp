import type { betterAuth } from "better-auth";
import type { Clock } from "../../lib/clock.ts";
import type { RunInBackground } from "../../lib/server/background.ts";
import type { PrismaClient } from "../../lib/server/db.ts";
import type { Mailer } from "../../lib/server/mail.ts";
import type { CookiePolicy } from "./cookies.ts";

/** The header that carries the client address into better-auth. Routes always overwrite it. */
export const CLIENT_IP_HEADER = "x-ruken-client-ip";

/**
 * Set by the public /api/auth route on every request it passes on, overwriting any copy the client
 * sent. The sign-up form's action calls better-auth without it.
 */
export const PUBLIC_ROUTE_HEADER = "x-ruken-public-route";

export interface AuthOptions {
  prisma: PrismaClient;
  /** BETTER_AUTH_SECRET: signs session cookies. */
  secret: string;
  /** BETTER_AUTH_URL: the site's own origin. */
  baseURL: string;
  mailer: Mailer;
  cookies: CookiePolicy;
  /** Time for the rules that count recent events. Defaults to the system clock. */
  clock?: Clock;
  /** Where a mail that could not be sent is reported. Gets no address. */
  log?: (message: string) => void;
  /** Where mail sent after the answer runs. */
  runInBackground?: RunInBackground;
}

export type Auth = ReturnType<typeof betterAuth>;

export function createAuth(options: AuthOptions): Auth {
  throw new Error(`not built yet (${options.baseURL})`);
}

/** What the request hook needs from a signed-in session. */
export interface SessionInfo {
  sessionId: string;
  userId: string;
  /** `User.status`. Only an `active` account counts as signed in. */
  userStatus: string;
  /** The refreshed session cookie better-auth sent back, to copy onto the response. */
  setCookies?: string[];
}

export function sessionInfo(auth: Auth, headers: Headers): Promise<SessionInfo | null> {
  throw new Error(`not built yet (${typeof auth} ${typeof headers})`);
}
