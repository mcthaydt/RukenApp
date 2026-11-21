import { isAPIError } from "better-auth/api";
import { systemClock, type Clock } from "../../lib/clock.ts";
import { runAfterAnswer } from "../../lib/server/background.ts";
import { prisma as requestPrisma, type PrismaClient } from "../../lib/server/db.ts";
import { optionalEnv, requireEnv } from "../../lib/server/env.ts";
import { createResendMailer, type Mailer } from "../../lib/server/mail.ts";
import { createRateLimiter } from "../../lib/server/rate-limit.ts";
import { createTwilioTexter, type Texter } from "../../lib/server/text.ts";
import { createAuth, sessionInfo, type Auth } from "./auth.ts";
import { codesPausedFor, countWrongCode } from "./auth-limits-plugin.ts";
import { cookiePolicy, type CookiePolicy } from "./cookies.ts";
import type { FormDeps, ResetDeps, SignUpDeps } from "./forms.ts";
import type { HandleDeps } from "./handle.ts";
import { keepPending, takePending } from "./pending-sign-up.ts";
import { makeAccount, removeHalfMadeAccount } from "./sign-up-account.ts";
import { staffRolesOf } from "./staff.ts";

/** Codes typed on the sign-up screen from one client address: what a person retyping a code needs, and no more. */
const CODE_TRIES_PER_CLIENT = { max: 10, windowMs: 15 * 60_000 };

// Everything sign-in needs, built once per server process from the settings. Routes and the hook
// call authServices(); tests build their own with createAuthServices.

type Settings = Readonly<Record<string, string | undefined>>;

const STAND_IN_ADDRESS = "http://127.0.0.1:";

/**
 * The mail or text service's address, which only a stand-in on this machine may replace. Refused at start, so a real
 * site can never be pointed away from Resend or Twilio, where its codes would go to whoever runs the other end.
 */
function standInAddress(name: string, source: Settings): string | undefined {
  const value = optionalEnv(name, source);
  if (value !== undefined && !value.startsWith(STAND_IN_ADDRESS)) {
    throw new Error(`${name} is for a stand-in on this machine only: it must start with ${STAND_IN_ADDRESS}`);
  }
  return value;
}

export interface AuthServices {
  prisma: PrismaClient;
  clock: Clock;
  cookies: CookiePolicy;
  mailer: Mailer;
  texter: Texter;
  auth: Auth;
  /** BETTER_AUTH_SECRET, for the keyed hashes of numbers and browsers. */
  secret: string;
  handleDeps: HandleDeps;
  formDeps: FormDeps;
  resetDeps: ResetDeps;
  signUpDeps: SignUpDeps;
}

/**
 * Reads the settings first, so a missing one stops the start with its name before anything is
 * connected. `db` is the database client; left out, the running request's (`prisma()`).
 */
export function createAuthServices(source: Settings, db?: PrismaClient): AuthServices {
  const secret = requireEnv("BETTER_AUTH_SECRET", source);
  const baseURL = requireEnv("BETTER_AUTH_URL", source);
  const resendApiKey = requireEnv("RESEND_API_KEY", source);
  const mailFrom = requireEnv("MAIL_FROM", source);
  const allowlist = optionalEnv("MAIL_ALLOWLIST", source);
  const mailApiBase = standInAddress("RESEND_API_BASE", source);
  // Asked for here and not before, so the site keeps running between branch A of the texts plan and this one.
  const accountSid = requireEnv("TWILIO_ACCOUNT_SID", source);
  const apiKey = requireEnv("TWILIO_API_KEY", source);
  const apiSecret = requireEnv("TWILIO_API_SECRET", source);
  const accountService = requireEnv("TWILIO_ACCOUNT_SERVICE", source);
  const newsService = requireEnv("TWILIO_NEWS_SERVICE", source);
  const verifyService = requireEnv("TWILIO_VERIFY_SERVICE", source);
  const textAllowlist = optionalEnv("TEXT_ALLOWLIST", source);
  // The stand-in serves the messages, lookups and Verify addresses alike.
  const textApiBase = standInAddress("TWILIO_API_BASE", source);

  const prisma = db ?? requestPrisma();
  const clock = systemClock;
  const cookies = cookiePolicy(baseURL);
  const mailer = createResendMailer({
    apiKey: resendApiKey,
    from: mailFrom,
    allowlist,
    ...(mailApiBase === undefined ? {} : { apiBase: mailApiBase }),
  });
  const texter = createTwilioTexter({
    accountSid,
    apiKey,
    apiSecret,
    services: { account: accountService, news: newsService },
    verifyService,
    allowlist: textAllowlist,
    ...(textApiBase === undefined
      ? {}
      : { apiBase: textApiBase, lookupBase: textApiBase, verifyBase: textApiBase }),
    log: (line) => {
      console.warn(`text: ${line}`);
    },
  });
  const auth = createAuth({ prisma, secret, baseURL, mailer, texter, cookies, clock });

  const handleDeps: HandleDeps = {
    cookies,
    getSession: (headers) => sessionInfo(auth, headers),
    staffRolesOf: (userId) => staffRolesOf(prisma, userId),
  };
  const formDeps: FormDeps = { handler: (request) => auth.handler(request), baseURL, cookies };
  /** Tells Verify the code was used, after the answer. `codeUsed` never throws. */
  const codeUsed = (number: string): void => {
    runAfterAnswer(async () => {
      await texter.codeUsed(number);
    });
  };
  const resetDeps: ResetDeps = { ...formDeps, codeUsed };
  const wrongCodes = { limiter: createRateLimiter(prisma, clock), secret };
  const signUpDeps: SignUpDeps = {
    ...resetDeps,
    clock,
    hashPassword: async (password) => (await auth.$context).password.hash(password),
    keepPending: (input) => keepPending({ db: prisma, clock, secret }, input),
    takePending: (input) => takePending({ db: prisma, clock, secret }, input),
    countCodeTry: async (address) =>
      (await wrongCodes.limiter.hit(`api:sign-up-code:${address}`, CODE_TRIES_PER_CLIENT)).allowed,
    accountExists: async (number) => (await prisma.user.count({ where: { phoneNumber: number } })) > 0,
    consumeCode: async (number, code) => {
      try {
        await auth.api.consumePhoneNumberOTP({ body: { phoneNumber: number, code } });
        return "ok";
      } catch (error) {
        // A wrong code and one that used up its three tries are both counted as wrong; a code that is missing or
        // has run out is neither (better-auth's own count at `verify` is the same).
        const code = isAPIError(error) ? (error.body as { code?: unknown } | undefined)?.code : undefined;
        return code === "INVALID_OTP" || code === "TOO_MANY_ATTEMPTS" ? "wrong" : "other";
      }
    },
    countWrongCode: (number) => countWrongCode(wrongCodes, number),
    codesPaused: (number) => codesPausedFor(wrongCodes, number),
    makeAccount: (input) => makeAccount({ db: prisma, clock, secret }, input),
    removeHalfMadeAccount: (userId) => removeHalfMadeAccount(prisma, userId),
  };
  return {
    prisma,
    clock,
    cookies,
    mailer,
    texter,
    auth,
    secret,
    handleDeps,
    formDeps,
    resetDeps,
    signUpDeps,
  };
}

let shared: AuthServices | undefined;

/** The process-wide sign-in services, created on first use. */
export function authServices(): AuthServices {
  shared ??= createAuthServices(process.env);
  return shared;
}
