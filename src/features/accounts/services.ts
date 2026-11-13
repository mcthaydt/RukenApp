import { systemClock, type Clock } from "../../lib/clock.ts";
import {
  createPrismaClient,
  poolMaxFromEnv,
  prisma as sharedPrisma,
  type PrismaClient,
} from "../../lib/server/db.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { createSmtpMailer, smtpTransport, type Mailer } from "../../lib/server/mail.ts";
import { setBirthDate } from "./age.ts";
import { createAuth, sessionInfo, type Auth } from "./auth.ts";
import { cookiePolicy, type CookiePolicy } from "./cookies.ts";
import type { FormDeps, SignUpDeps } from "./forms.ts";
import type { HandleDeps } from "./handle.ts";
import { staffRolesOf } from "./staff.ts";

// Everything sign-in needs, built once per server process from the settings. Routes and the hook
// call authServices(); tests build their own with createAuthServices.

type Settings = Readonly<Record<string, string | undefined>>;

/** Each function instance keeps its pool small. */
const DEFAULT_POOL_MAX = 3;

export interface AuthServices {
  prisma: PrismaClient;
  clock: Clock;
  cookies: CookiePolicy;
  mailer: Mailer;
  auth: Auth;
  handleDeps: HandleDeps;
  formDeps: FormDeps;
  signUpDeps: SignUpDeps;
}

/**
 * Reads the settings first, so a missing one stops the start with its name before anything is
 * connected. `db` is the database client; left out, one is made from `DATABASE_URL`.
 */
export function createAuthServices(source: Settings, db?: PrismaClient): AuthServices {
  const secret = requireEnv("BETTER_AUTH_SECRET", source);
  const baseURL = requireEnv("BETTER_AUTH_URL", source);
  const smtpUrl = requireEnv("SMTP_URL", source);
  const mailFrom = requireEnv("MAIL_FROM", source);
  const allowlist = optionalEnv("MAIL_ALLOWLIST", source);

  const prisma =
    db ??
    createPrismaClient(requireEnv("DATABASE_URL", source), {
      poolMax: poolMaxFromEnv(source, DEFAULT_POOL_MAX),
    });
  const clock = systemClock;
  const cookies = cookiePolicy(baseURL);
  const mailer = createSmtpMailer({ from: mailFrom, allowlist, transport: smtpTransport(smtpUrl) });
  const auth = createAuth({ prisma, secret, baseURL, mailer, cookies, clock });

  const handleDeps: HandleDeps = {
    cookies,
    getSession: (headers) => sessionInfo(auth, headers),
    staffRolesOf: (userId) => staffRolesOf(prisma, userId),
  };
  const formDeps: FormDeps = { handler: (request) => auth.handler(request), baseURL, cookies };
  const signUpDeps: SignUpDeps = {
    ...formDeps,
    clock,
    setBirthDate: (userId, date) => setBirthDate(prisma, clock, { userId, date }),
  };
  return { prisma, clock, cookies, mailer, auth, handleDeps, formDeps, signUpDeps };
}

let shared: AuthServices | undefined;

/** The process-wide sign-in services, created on first use. */
export function authServices(): AuthServices {
  shared ??= createAuthServices(process.env, sharedPrisma());
  return shared;
}
