import { isRedirect } from "@sveltejs/kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuth,
  PUBLIC_ROUTE_HEADER,
  sessionInfo,
  type Auth,
} from "../../../src/features/accounts/auth.ts";
import { setMoneyCheck } from "../../../src/features/accounts/changed-hands.ts";
import { cookiePolicy, WELCOME_BACK_COOKIE } from "../../../src/features/accounts/cookies.ts";
import { signInWithPassword, type FormEvent } from "../../../src/features/accounts/forms.ts";
import {
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "../../../src/features/accounts/sign-in-guard.ts";
import {
  alreadyText,
  passwordChangedText,
  signInPausedText,
} from "../../../src/features/accounts/text-words.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import type { MailMessage, Mailer } from "../../../src/lib/server/mail.ts";
import { setPlatform } from "../../../src/lib/server/platform.ts";
import { TextError, type Texter } from "../../../src/lib/server/text.ts";
import { createCaptureMailer } from "../../support/capture-mailer.ts";
import { createCaptureTexter } from "../../support/capture-texter.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// better-auth for real, on the real schema in a throwaway Postgres. These tests prove that our
// configuration fits the tables and behaves as the design says. Every test signs in or up through
// better-auth, which hashes passwords with scrypt on purpose (slow by design); the postgres test
// project allows 30 seconds a test for that.

const ORIGIN = "http://localhost:5173";
const SECRET = "test_secret_that_is_at_least_32_chars";
const PASSWORD = "correct horse";
const cookies = cookiePolicy(ORIGIN);

let database: TestDatabase | undefined;
let auth: Auth | undefined;
const clock = new TestClock(new Date().toISOString());
const texter = createCaptureTexter();
const capture = createCaptureMailer();
const mail: MailMessage[] = capture.sent;
const logged: string[] = [];

/**
 * Texts and mail go out after the answer, through `runInBackground`. The tests hand every auth this runner,
 * and `post` waits for it, so a test still sees what a request sent.
 */
const background: Promise<void>[] = [];
function runInBackground(task: () => Promise<void>): void {
  background.push(task());
}
async function settleBackground(): Promise<void> {
  while (background.length > 0) await Promise.allSettled(background.splice(0));
}

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}

function theAuth(): Auth {
  if (auth === undefined) throw new Error("auth was not created");
  return auth;
}

beforeAll(async () => {
  database = await startTestDatabase();
  auth = createAuth({
    prisma: database.prisma,
    secret: SECRET,
    baseURL: ORIGIN,
    mailer: capture,
    texter,
    cookies,
    clock,
    log: (line) => logged.push(line),
    runInBackground,
  });
});

afterAll(async () => {
  await database?.stop();
});

// Each test comes from its own client address so the per-client limits never get in the way.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  // Three numbers wide, so a long file of tests never runs past 254 and gets an address that is not valid.
  return `203.0.${String(Math.floor(ipCounter / 250))}.${String((ipCounter % 250) + 1)}`;
}

let numberCounter = 0;
function nextNumber(): string {
  numberCounter += 1;
  return `+1312557${String(numberCounter).padStart(4, "0")}`;
}

async function post(
  path: string,
  body: unknown,
  init: { ip?: string; cookie?: string; origin?: string; auth?: Auth } = {},
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
    origin: init.origin ?? ORIGIN,
    "x-ruken-client-ip": init.ip ?? nextIp(),
  });
  if (init.cookie !== undefined) headers.set("cookie", init.cookie);
  const response = await (init.auth ?? theAuth()).handler(
    new Request(`${ORIGIN}/api/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
  );
  await settleBackground();
  return response;
}

/** The `name=value` pairs a response sets, ready to send back as a Cookie header. */
function cookieHeaderFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
}

/** An account with a password, made the way the sign-up form's last step makes one, without the slow code round trip. */
async function accountWith(
  number: string,
  options: { password?: string; paperEmail?: string; auth?: Auth } = {},
): Promise<string> {
  const context = await (options.auth ?? theAuth()).$context;
  const user = await db().user.create({
    data: {
      name: "Player",
      email: `${crypto.randomUUID()}@phone.ruken.invalid`,
      phoneNumber: number,
      phoneNumberVerified: true,
      paperEmail: options.paperEmail ?? null,
    },
  });
  await db().account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await context.password.hash(options.password ?? PASSWORD),
    },
  });
  return user.id;
}

const codesTo = (number: string) => texter.codes.filter((code) => code.to === number);
const textsTo = (number: string) => texter.sent.filter((text) => text.to === number);

beforeEach(() => {
  // A site that has not told us about money yet counts every account as having some; these tests mean the plain case.
  setMoneyCheck(() => Promise.resolve(false));
});

describe("what the public /api/auth route lets through", () => {
  const forwarded = (path: string): Promise<Response> =>
    theAuth().handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          "x-ruken-client-ip": nextIp(),
          // The public route sets this on every request it passes on (forward.ts); the forms' own calls do not.
          [PUBLIC_ROUTE_HEADER]: "1",
        },
        body: JSON.stringify({
          phoneNumber: nextNumber(),
          code: "123456",
          password: PASSWORD,
          email: "x@example.test",
        }),
      }),
    );

  it.each([
    "/sign-up/email",
    "/sign-in/email",
    "/sign-in/phone-number",
    "/phone-number/send-otp",
    "/phone-number/verify",
    "/phone-number/request-password-reset",
    "/phone-number/reset-password",
    "/request-password-reset",
    "/reset-password",
    "/send-verification-email",
    "/change-email",
    "/update-user",
  ])("answers 404 for %s, so a code never signs anyone in from outside", async (path) => {
    expect((await forwarded(path)).status).toBe(404);
  });

  it("does not let posts from outside fill the client's limit on the sign-up code, which the form's two paths must share", async () => {
    const ip = nextIp();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const outside = await theAuth().handler(
        new Request(`${ORIGIN}/api/auth/phone-number/verify`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            "x-ruken-client-ip": ip,
            [PUBLIC_ROUTE_HEADER]: "1",
          },
          body: JSON.stringify({ phoneNumber: nextNumber(), code: "000000" }),
        }),
      );
      expect(outside.status).toBe(404);
    }
    // The form's own call, from the same client, is not refused by better-auth's limiter.
    const number = nextNumber();
    await post("/phone-number/send-otp", { phoneNumber: number }, { ip });
    const typed = await post("/phone-number/verify", { phoneNumber: number, code: "000000" }, { ip });
    expect(typed.status).toBe(400);
  });

  it("still answers /ok, /get-session and /sign-out", async () => {
    const ok = await theAuth().handler(
      new Request(`${ORIGIN}/api/auth/ok`, { headers: { [PUBLIC_ROUTE_HEADER]: "1" } }),
    );
    expect(ok.status).toBe(200);
    expect((await forwarded("/sign-out")).status).toBe(200);
    const session = await theAuth().handler(
      new Request(`${ORIGIN}/api/auth/get-session`, { headers: { [PUBLIC_ROUTE_HEADER]: "1" } }),
    );
    expect(session.status).toBe(200);
  });

  it("is the only way in: email sign-up is off even for our own forms", async () => {
    const email = "someone@example.test";
    const response = await post("/sign-up/email", { email, password: "correct horse", name: "Player" });
    expect(response.status).toBe(400);
    expect(await db().user.count({ where: { email } })).toBe(0);
  });
});

describe("a code to sign up", () => {
  it("texts a six digit code through Verify to a number nobody has, and makes no account yet", async () => {
    const number = nextNumber();
    const response = await post("/phone-number/send-otp", { phoneNumber: number });
    expect(response.status).toBe(200);

    expect(codesTo(number)).toHaveLength(1);
    expect(codesTo(number)[0]?.code).toMatch(/^\d{6}$/);
    expect(textsTo(number)).toEqual([]);
    expect(await db().user.count({ where: { phoneNumber: number } })).toBe(0);
  });

  it("refuses a number that is not E.164, and sends nothing", async () => {
    for (const phoneNumber of ["3125551234", "+1312", "+1 312 555 1234", "", "abc"]) {
      expect((await post("/phone-number/send-otp", { phoneNumber })).status).toBe(400);
    }
    expect(texter.codes.filter((code) => !code.to.startsWith("+13125"))).toEqual([]);
  });

  it("sends a number that has an account no code, one text that says so, and writes the same row", async () => {
    const taken = nextNumber();
    const free = nextNumber();
    await accountWith(taken);

    const first = await post("/phone-number/send-otp", { phoneNumber: taken });
    const second = await post("/phone-number/send-otp", { phoneNumber: free });

    expect(first.status).toBe(second.status);
    expect(await first.json()).toEqual(await second.json());
    expect(codesTo(taken)).toEqual([]);
    expect(textsTo(taken)).toEqual([{ to: taken, line: "account", body: alreadyText(ORIGIN) }]);
    expect(codesTo(free)).toHaveLength(1);
    // Both leave a code for better-auth to check, so the form can check a typed code the same way for both.
    for (const identifier of [taken, free])
      expect(await db().verification.count({ where: { identifier } })).toBe(1);
  });

  it("makes the account, with a session and a cookie a script cannot read, when the code is typed", async () => {
    const number = nextNumber();
    await post("/phone-number/send-otp", { phoneNumber: number });
    const code = codesTo(number)[0]?.code ?? "";

    const response = await post("/phone-number/verify", { phoneNumber: number, code });
    expect(response.status).toBe(200);

    const user = await db().user.findUniqueOrThrow({ where: { phoneNumber: number } });
    expect(user.id).toMatch(/^[a-z][a-z0-9]{23}$/);
    expect(user.status).toBe("active");
    expect(user.phoneNumberVerified).toBe(true);
    // better-auth cannot make a user without an email: a stand-in that can never be real and is never mailed.
    expect(user.email).toMatch(/^[0-9a-f-]{36}@phone\.ruken\.invalid$/);
    expect(await db().session.count({ where: { userId: user.id } })).toBe(1);
    expect(await db().verification.count({ where: { identifier: number } })).toBe(0);

    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toContain("rk_session=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it("checks a typed code three times, then asks for a new one", async () => {
    const number = nextNumber();
    await post("/phone-number/send-otp", { phoneNumber: number });
    const code = codesTo(number)[0]?.code ?? "";
    const wrong = code === "000000" ? "111111" : "000000";

    expect((await post("/phone-number/verify", { phoneNumber: number, code: wrong })).status).toBe(400);
    expect((await post("/phone-number/verify", { phoneNumber: number, code: wrong })).status).toBe(400);
    expect((await post("/phone-number/verify", { phoneNumber: number, code: wrong })).status).toBe(400);
    const spent = await post("/phone-number/verify", { phoneNumber: number, code });
    expect(spent.status).toBe(403);
    expect(await db().user.count({ where: { phoneNumber: number } })).toBe(0);
  });

  it("holds a second code in place of the first: only the newer one works", async () => {
    const number = nextNumber();
    await post("/phone-number/send-otp", { phoneNumber: number });
    clock.advance(31_000);
    await post("/phone-number/send-otp", { phoneNumber: number });
    const [older, newer] = codesTo(number).map((entry) => entry.code);

    expect(codesTo(number)).toHaveLength(2);
    if (older === newer) return; // one in a million, and then neither tells the other apart
    expect((await post("/phone-number/verify", { phoneNumber: number, code: older ?? "" })).status).toBe(400);
    expect((await post("/phone-number/verify", { phoneNumber: number, code: newer ?? "" })).status).toBe(200);
  });

  it("refuses a second ask inside 30 seconds as too soon, and sends nothing for it", async () => {
    const number = nextNumber();
    expect((await post("/phone-number/send-otp", { phoneNumber: number })).status).toBe(200);
    const again = await post("/phone-number/send-otp", { phoneNumber: number });
    expect(again.status).toBe(429);
    expect(await again.json()).toMatchObject({ code: "CODE_TOO_SOON" });
    expect(codesTo(number)).toHaveLength(1);
  });

  it("pauses codes for the number after ten wrong ones, and says the same for a number with an account", async () => {
    const taken = nextNumber();
    const free = nextNumber();
    await accountWith(taken);
    const results: string[] = [];
    for (const number of [taken, free]) {
      await post("/phone-number/send-otp", { phoneNumber: number });
      // Three tries a code, so ask again between rounds of three.
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (attempt % 3 === 0 && attempt > 0) {
          clock.advance(31_000);
          await post("/phone-number/send-otp", { phoneNumber: number });
        }
        await post("/phone-number/verify", { phoneNumber: number, code: "000000" }, { ip: nextIp() });
      }
      clock.advance(31_000);
      const asked = await post("/phone-number/send-otp", { phoneNumber: number });
      results.push(`${String(asked.status)} ${JSON.stringify(await asked.json())}`);
    }
    expect(results[0]).toContain("CODES_PAUSED");
    expect(results[1]).toBe(results[0]);
    clock.advance(60 * 60 * 1000);
    expect((await post("/phone-number/send-otp", { phoneNumber: free })).status).toBe(200);
  });
});

describe("sign-in with a phone number and a password", () => {
  it("returns a session cookie that resolves to the signed-in user", async () => {
    const number = nextNumber();
    const id = await accountWith(number);

    const response = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });
    expect(response.status).toBe(200);

    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    expect(info).toEqual({ sessionId: expect.any(String) as string, userId: id, userStatus: "active" });
  });

  it("refuses a wrong password, and a number with no account, in the same words", async () => {
    const number = nextNumber();
    await accountWith(number);
    const wrong = await post("/sign-in/phone-number", { phoneNumber: number, password: "wrong horse!" });
    const stranger = await post("/sign-in/phone-number", { phoneNumber: nextNumber(), password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(stranger.status).toBe(401);
    expect(await stranger.json()).toEqual(await wrong.json());
  });

  it("limits quick attempts for one number from one client address", async () => {
    const ip = nextIp();
    const number = nextNumber();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      statuses.push(
        (await post("/sign-in/phone-number", { phoneNumber: number, password: "wrong horse!" }, { ip }))
          .status,
      );

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    // Another number from the same client, and the same number from another client, still get an answer.
    expect(
      (await post("/sign-in/phone-number", { phoneNumber: nextNumber(), password: "wrong horse!" }, { ip }))
        .status,
    ).toBe(401);
    expect(
      (await post("/sign-in/phone-number", { phoneNumber: number, password: "wrong horse!" })).status,
    ).toBe(401);
    // The counter is kept under the keyed hash of the number, never the number itself.
    const keys = (
      await db().rateLimit.findMany({ where: { key: { contains: ip } }, select: { key: true } })
    ).map((row) => row.key);
    expect(keys.join("\n")).not.toContain(number.slice(2));
  });

  it("still stops one client address trying many numbers quickly, at a wider limit", async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 31; attempt += 1)
      statuses.push(
        (await post("/sign-in/phone-number", { phoneNumber: nextNumber(), password: "wrong horse!" }, { ip }))
          .status,
      );

    expect(statuses.slice(0, 30).every((status) => status === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});

describe("session cookie on https", () => {
  // Every other test runs on http://localhost, where the cookie is a plain rk_session. On https it
  // is __Host-rk_session, which a browser silently drops unless it is Secure, has Path=/ and no
  // Domain. Three settings decide that together (useSecureCookies, defaultCookieAttributes and the
  // form actions' copy in cookies.ts), so this drives real BetterAuth on an https origin.
  const HTTPS_ORIGIN = "https://ruken.test";
  const httpsCookies = cookiePolicy(HTTPS_ORIGIN);
  let httpsAuth: Auth | undefined;
  const sessionLine = /^__Host-rk_session=[^;]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/;

  beforeAll(() => {
    httpsAuth = createAuth({
      prisma: db(),
      secret: SECRET,
      baseURL: HTTPS_ORIGIN,
      mailer: { send: () => Promise.resolve(true) },
      texter: createCaptureTexter(),
      cookies: httpsCookies,
      runInBackground,
    });
  });

  function theHttpsAuth(): Auth {
    if (httpsAuth === undefined) throw new Error("the https auth was not created");
    return httpsAuth;
  }

  it("sets __Host-rk_session with Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain at sign-in", async () => {
    const number = nextNumber();
    await accountWith(number, { auth: theHttpsAuth() });
    const response = await theHttpsAuth().handler(
      new Request(`${HTTPS_ORIGIN}/api/auth/sign-in/phone-number`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: HTTPS_ORIGIN, "x-ruken-client-ip": nextIp() },
        body: JSON.stringify({ phoneNumber: number, password: PASSWORD }),
      }),
    );

    expect(response.status).toBe(200);
    const sessionLines = response.headers
      .getSetCookie()
      .filter((line) => line.startsWith("__Host-rk_session="));
    expect(sessionLines).toHaveLength(1);
    expect(sessionLines[0]).toMatch(sessionLine);
  });

  it("keeps Secure and HttpOnly when the sign-in form copies the cookie onto the page", async () => {
    const number = nextNumber();
    await accountWith(number, { auth: theHttpsAuth() });
    const set = vi.fn();
    const event = {
      request: new Request(`${HTTPS_ORIGIN}/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ country: "US", phone: number.slice(2), password: PASSWORD, next: "/" }),
      }),
      getClientAddress: () => nextIp(),
      cookies: {
        set,
        // Enough of SvelteKit's Set-Cookie parsing for this line: the name, value, path and flags. cspell:ignore httponly samesite
        parse: (line: string) => {
          const [pair = "", ...attributes] = line.split(";").map((part) => part.trim());
          const [name = "", value = ""] = pair.split("=");
          const lower = attributes.map((attribute) => attribute.toLowerCase());
          return {
            name,
            value,
            path: attributes.find((attribute) => attribute.toLowerCase().startsWith("path="))?.split("=")[1],
            ...(lower.includes("secure") ? { secure: true } : {}),
            ...(lower.includes("httponly") ? { httpOnly: true } : {}),
            ...(lower.includes("samesite=lax") ? { sameSite: "lax" } : {}),
          };
        },
      },
    } as unknown as FormEvent;

    await expect(
      signInWithPassword(event, {
        handler: theHttpsAuth().handler,
        baseURL: HTTPS_ORIGIN,
        cookies: httpsCookies,
      }),
    ).rejects.toSatisfy(isRedirect);

    const sessionSet = set.mock.calls.find(([name]) => name === "__Host-rk_session");
    expect(sessionSet?.[2]).toMatchObject({ path: "/", secure: true, httpOnly: true, sameSite: "lax" });
    expect(sessionSet?.[2]).not.toHaveProperty("domain");
  });
});

describe("forgot password", () => {
  const request = (number: string) => post("/phone-number/request-password-reset", { phoneNumber: number });
  const finish = (number: string, otp: string, newPassword = "a brand new horse") =>
    post("/phone-number/reset-password", { phoneNumber: number, otp, newPassword });

  it("texts a code through Verify to an account that never paid, and answers the same for any number", async () => {
    const known = nextNumber();
    const stranger = nextNumber();
    await accountWith(known);

    const first = await request(known);
    const second = await request(stranger);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(codesTo(known)).toHaveLength(1);
    expect(codesTo(known)[0]?.code).toMatch(/^\d{6}$/);
    expect(codesTo(stranger)).toEqual([]);
    expect(textsTo(stranger)).toEqual([]);
    // Both wrote the row, so the second screen and its code check read the same for both.
    for (const identifier of [`${known}-request-password-reset`, `${stranger}-request-password-reset`])
      expect(await db().verification.count({ where: { identifier } })).toBe(1);
  });

  it("sets the new password once, signs every device out, lifts the pause and texts a notice", async () => {
    const number = nextNumber();
    await accountWith(number);
    const signedIn = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });
    const cookie = cookieHeaderFrom(signedIn);
    await request(number);
    const code = codesTo(number)[0]?.code ?? "";

    expect((await finish(number, code)).status).toBe(200);

    expect(await sessionInfo(theAuth(), new Headers({ cookie }))).toBeNull();
    expect((await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD })).status).toBe(
      401,
    );
    expect(
      (await post("/sign-in/phone-number", { phoneNumber: number, password: "a brand new horse" })).status,
    ).toBe(200);
    expect(textsTo(number)).toEqual([{ to: number, line: "account", body: passwordChangedText(ORIGIN) }]);
    // The code works once.
    expect((await finish(number, code, "yet another horse")).status).toBe(400);
  });

  it("does not sign the person in by itself", async () => {
    const number = nextNumber();
    await accountWith(number);
    await request(number);
    const response = await finish(number, codesTo(number)[0]?.code ?? "");
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("refuses a wrong code, and counts it toward the pause on codes", async () => {
    const number = nextNumber();
    await accountWith(number);
    await request(number);
    const wrong = await finish(number, "000000");
    expect(wrong.status).toBe(400);
    expect(
      await db().rateLimit.count({ where: { key: { startsWith: "api:auth:wrong-code:" } } }),
    ).toBeGreaterThan(0);
  });

  it("refuses a new password that is too short or too long", async () => {
    for (const newPassword of ["a".repeat(9), "a".repeat(129)]) {
      const number = nextNumber();
      await accountWith(number);
      await request(number);
      expect((await finish(number, codesTo(number)[0]?.code ?? "", newPassword)).status).toBe(400);
      expect((await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD })).status).toBe(
        200,
      );
    }
  });

  it("sends a member whose number may have changed hands the code by email, to the address they paid with", async () => {
    const number = nextNumber();
    await accountWith(number, { paperEmail: "pay@example.test" });
    setMoneyCheck(() => Promise.resolve(true));
    mail.length = 0;

    await request(number);

    expect(codesTo(number)).toEqual([]);
    expect(mail).toHaveLength(1);
    expect(mail[0]?.to).toBe("pay@example.test");
    const code = /\b(\d{6})\b/.exec(mail[0]?.text ?? "")?.[1] ?? "";
    expect(code).not.toBe("");
    expect((await finish(number, code)).status).toBe(200);
  });

  it("sends nothing, and logs that it was held for help, when there is no email to send to", async () => {
    const number = nextNumber();
    await accountWith(number);
    setMoneyCheck(() => Promise.resolve(true));
    mail.length = 0;
    logged.length = 0;

    expect((await request(number)).status).toBe(200);

    expect(codesTo(number)).toEqual([]);
    expect(mail).toEqual([]);
    expect(logged).toContain("reset held for help");
    expect(logged.join("\n")).not.toContain(number.slice(2));
  });

  it("sends nothing by text when Twilio says the number changed hands", async () => {
    const number = nextNumber();
    await accountWith(number, { paperEmail: "pay@example.test" });
    texter.hands.set(number, "yes");
    mail.length = 0;

    await request(number);

    expect(codesTo(number)).toEqual([]);
    expect(mail.map((message) => message.to)).toEqual(["pay@example.test"]);
  });

  it("logs a code that could not be sent by Twilio's code only, never the number", async () => {
    const number = nextNumber();
    await accountWith(number);
    const failing = createAuth({
      prisma: db(),
      secret: SECRET,
      baseURL: ORIGIN,
      mailer: capture,
      texter: {
        ...texter,
        sendCode: () => Promise.reject(new TextError(400, 21610)),
      },
      cookies,
      clock,
      log: (line) => logged.push(line),
      runInBackground,
    });
    logged.length = 0;

    expect(
      (await post("/phone-number/request-password-reset", { phoneNumber: number }, { auth: failing })).status,
    ).toBe(200);

    expect(logged).toEqual(["reset code not sent: TWILIO 400 21610"]);
  });
});

describe("account sign-in pause", () => {
  // A second auth with its own clock, so an hour passes in a line, and its own texts and log.
  const pauseClock = new TestClock("2026-10-23T12:00:00Z");
  const pauseTexter = createCaptureTexter();
  const pauseLog: string[] = [];
  let textFails = false;
  let pauseAuth: Auth | undefined;

  beforeAll(() => {
    const failing: Texter = {
      ...pauseTexter,
      send: (message) => {
        // As Twilio fails a send it will not make: its status and its code, never the number.
        if (textFails) return Promise.reject(new TextError(400, 21610));
        return pauseTexter.send(message);
      },
    };
    pauseAuth = createAuth({
      prisma: db(),
      secret: SECRET,
      baseURL: ORIGIN,
      mailer: capture,
      texter: failing,
      cookies,
      clock: pauseClock,
      log: (line) => pauseLog.push(line),
      runInBackground,
    });
  });

  const thePauseAuth = (): Auth => pauseAuth ?? theAuth();
  const signIn = (number: string, password: string) =>
    post("/sign-in/phone-number", { phoneNumber: number, password }, { auth: thePauseAuth() });

  async function accountWithPassword(): Promise<string> {
    const number = nextNumber();
    await accountWith(number, { auth: thePauseAuth() });
    return number;
  }

  async function failTimes(number: string, count: number): Promise<void> {
    for (let index = 0; index < count; index += 1)
      expect((await signIn(number, "wrong horse")).status).toBe(401);
  }

  const noticesTo = (number: string) =>
    pauseTexter.sent.filter((text) => text.to === number && text.body === signInPausedText(ORIGIN));

  it("refuses the right password too, for an hour, after ten wrong ones", async () => {
    const number = await accountWithPassword();

    await failTimes(number, SIGN_IN_FAILURE_LIMIT);

    const refused = await signIn(number, PASSWORD);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: "SIGN_IN_PAUSED" });
    expect(refused.headers.getSetCookie()).toEqual([]);
  });

  it("still lets the nine-times-wrong number in with the right password", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(number, PASSWORD)).status).toBe(200);
  });

  it("answers exactly the same for a number with no account", async () => {
    const known = await accountWithPassword();
    const stranger = nextNumber();
    await failTimes(known, SIGN_IN_FAILURE_LIMIT);
    await failTimes(stranger, SIGN_IN_FAILURE_LIMIT);

    const first = await signIn(known, PASSWORD);
    const second = await signIn(stranger, PASSWORD);

    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
  });

  it("lets the right password in again when the hour is over", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT);
    pauseClock.advance(SIGN_IN_PAUSE_MS - 1);
    expect((await signIn(number, PASSWORD)).status).toBe(429);

    pauseClock.advance(1);

    expect((await signIn(number, PASSWORD)).status).toBe(200);
  });

  it("does not add up failures from different hours", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);
    pauseClock.advance(SIGN_IN_WINDOW_MS);
    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(number, PASSWORD)).status).toBe(200);
  });

  it("forgets earlier failures after a correct password", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);
    expect((await signIn(number, PASSWORD)).status).toBe(200);

    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(number, PASSWORD)).status).toBe(200);
  });

  it("leaves the reset request working while paused", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT);

    expect(
      (await post("/phone-number/request-password-reset", { phoneNumber: number }, { auth: thePauseAuth() }))
        .status,
    ).toBe(200);
    expect(pauseTexter.codes.filter((code) => code.to === number)).toHaveLength(1);
  });

  it("is lifted by a finished password reset", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT);
    await post("/phone-number/request-password-reset", { phoneNumber: number }, { auth: thePauseAuth() });
    const otp = pauseTexter.codes.filter((code) => code.to === number)[0]?.code ?? "";

    expect(
      (
        await post(
          "/phone-number/reset-password",
          { phoneNumber: number, otp, newPassword: "a brand new horse" },
          { auth: thePauseAuth() },
        )
      ).status,
    ).toBe(200);

    expect((await signIn(number, "a brand new horse")).status).toBe(200);
  });

  it("texts the account one notice when the pause starts, and nobody else", async () => {
    const number = await accountWithPassword();
    const stranger = nextNumber();

    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);
    await failTimes(stranger, SIGN_IN_FAILURE_LIMIT);
    expect(noticesTo(number)).toHaveLength(0);
    await failTimes(number, 1);

    await vi.waitFor(() => {
      expect(noticesTo(number)).toHaveLength(1);
    });
    expect(noticesTo(number)[0]?.line).toBe("account");
    await signIn(number, PASSWORD);
    expect(noticesTo(number)).toHaveLength(1);
    expect(pauseTexter.sent.filter((text) => text.to === stranger)).toHaveLength(0);
  });

  it("still answers a wrong password the usual way when the notice cannot be sent, and logs it by its code", async () => {
    const number = await accountWithPassword();
    await failTimes(number, SIGN_IN_FAILURE_LIMIT - 1);
    textFails = true;
    try {
      expect((await signIn(number, "wrong horse")).status).toBe(401);
      await vi.waitFor(() => {
        expect(pauseLog).toContain("sign-in pause notice not sent: TWILIO 400 21610");
      });
    } finally {
      textFails = false;
    }
    expect((await signIn(number, PASSWORD)).status).toBe(429);
    expect(pauseLog.join("\n")).not.toContain(number.slice(2));
  });

  it("does not count a made-up body or a number that cannot be one as a wrong password", async () => {
    const number = await accountWithPassword();

    for (let index = 0; index < SIGN_IN_FAILURE_LIMIT; index += 1) {
      await post("/sign-in/phone-number", { password: "wrong horse" }, { auth: thePauseAuth() });
      // A body better-auth refuses (400) was counted before the check and is given back after it.
      expect(
        (
          await post(
            "/sign-in/phone-number",
            { phoneNumber: "not a number", password: "x" },
            { auth: thePauseAuth() },
          )
        ).status,
      ).toBe(400);
      expect(
        (await post("/sign-in/phone-number", { phoneNumber: number }, { auth: thePauseAuth() })).status,
      ).toBe(400);
    }

    expect((await signIn(number, PASSWORD)).status).toBe(200);
  });

  it("checks no more than ten passwords when thirty arrive at once from thirty client addresses", async () => {
    const number = await accountWithPassword();

    const answers = await Promise.all(Array.from({ length: 30 }, () => signIn(number, "wrong horse")));
    const statuses = answers.map((answer) => answer.status);

    expect(statuses.filter((status) => status === 401)).toHaveLength(SIGN_IN_FAILURE_LIMIT);
    expect(statuses.filter((status) => status === 429)).toHaveLength(30 - SIGN_IN_FAILURE_LIMIT);
    expect((await signIn(number, PASSWORD)).status).toBe(429);
  });

  it("signs every device out after a reset even when the changed-password text cannot be sent, and logs it", async () => {
    const number = await accountWithPassword();
    const signedIn = await signIn(number, PASSWORD);
    const cookie = cookieHeaderFrom(signedIn);
    await post("/phone-number/request-password-reset", { phoneNumber: number }, { auth: thePauseAuth() });
    const otp = pauseTexter.codes.filter((code) => code.to === number)[0]?.code ?? "";

    textFails = true;
    try {
      expect(
        (
          await post(
            "/phone-number/reset-password",
            { phoneNumber: number, otp, newPassword: "a brand new horse" },
            { auth: thePauseAuth() },
          )
        ).status,
      ).toBe(200);
    } finally {
      textFails = false;
    }

    expect(await sessionInfo(thePauseAuth(), new Headers({ cookie }))).toBeNull();
    expect(pauseLog).toContain("password changed notice not sent: TWILIO 400 21610");
    expect(pauseLog.join("\n")).not.toContain(number.slice(2));
    expect((await signIn(number, "a brand new horse")).status).toBe(200);
  });

  /** A computer already let in for this account: its key row, as sign-in leaves it. */
  async function computerFor(userId: string): Promise<void> {
    await db().computerKey.create({
      data: { userId, name: "Dana's MacBook", keyHash: `hash-${userId}-${crypto.randomUUID()}` },
    });
  }

  async function resetPassword(number: string, withAuth: Auth): Promise<number> {
    await post("/phone-number/request-password-reset", { phoneNumber: number }, { auth: withAuth });
    const otp = pauseTexter.codes.filter((code) => code.to === number).at(-1)?.code ?? "";
    return (
      await post(
        "/phone-number/reset-password",
        { phoneNumber: number, otp, newPassword: "a brand new horse" },
        { auth: withAuth },
      )
    ).status;
  }

  it("ends every computer's key when the password is reset by text", async () => {
    const number = await accountWithPassword();
    const user = await db().user.findUniqueOrThrow({ where: { phoneNumber: number } });
    await computerFor(user.id);
    expect(await resetPassword(number, thePauseAuth())).toBe(200);
    expect(await db().computerKey.count({ where: { userId: user.id } })).toBe(0);
  });

  it("still signs every device out when the keys cannot be removed, and logs it", async () => {
    const number = await accountWithPassword();
    const cookie = cookieHeaderFrom(await signIn(number, PASSWORD));
    const user = await db().user.findUniqueOrThrow({ where: { phoneNumber: number } });
    await computerFor(user.id);
    // The same database, except that taking a computer's key away fails.
    const failing = new Proxy(db(), {
      get(target, name) {
        if (name === "computerKey") return { deleteMany: () => Promise.reject(new Error("no database")) };
        const value: unknown = Reflect.get(target, name, target);
        return typeof value === "function" ? (value as () => unknown).bind(target) : value;
      },
    });
    const breaking = createAuth({
      prisma: failing,
      secret: SECRET,
      baseURL: ORIGIN,
      mailer: capture,
      texter: pauseTexter,
      cookies,
      clock: pauseClock,
      log: (line) => pauseLog.push(line),
      runInBackground,
    });
    expect(await resetPassword(number, breaking)).toBe(200);
    expect(await sessionInfo(breaking, new Headers({ cookie }))).toBeNull();
    expect(pauseLog).toContain("computer keys not removed after a reset: no database");
  });
});

describe("signing in while a deletion waits", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** An account that asked to delete, with the purge `purgeInDays` days away (negative: already past). */
  async function deletingAccount(purgeInDays: number) {
    const number = nextNumber();
    const userId = await accountWith(number);
    await db().user.update({ where: { id: userId }, data: { status: "pending_deletion" } });
    // The hook reads the real clock, so the dates are relative to now.
    const now = clock.epochMs();
    await db().deletionRequest.create({
      data: {
        userId,
        requestedAt: new Date(now - 15 * DAY_MS),
        purgeAfter: new Date(now + purgeInDays * DAY_MS),
      },
    });
    return { number, userId };
  }

  const setsWelcomeBack = (response: Response) =>
    response.headers.getSetCookie().some((line) => line.startsWith(`${WELCOME_BACK_COOKIE}=1;`));

  it("restores the account within the 14 days and flags the welcome back", async () => {
    const { number, userId } = await deletingAccount(7);
    const response = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });

    expect(response.status).toBe(200);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    expect(setsWelcomeBack(response)).toBe(true);
    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    expect(info?.userStatus).toBe("active");
  });

  it("flags the welcome back for a cookie a script cannot read, short-lived, on the whole site", async () => {
    const { number } = await deletingAccount(7);
    const response = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });

    const line = response.headers
      .getSetCookie()
      .find((setCookie) => setCookie.startsWith(`${WELCOME_BACK_COOKIE}=`));
    expect(line).toMatch(/Max-Age=300/);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
  });

  it("keeps an account whose 14 days are over signed out, and flags nothing", async () => {
    const { number } = await deletingAccount(-1);
    const response = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });

    expect(setsWelcomeBack(response)).toBe(false);
    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    expect(info?.userStatus).toBe("pending_deletion");
  });

  it("flags nothing for an ordinary sign-in", async () => {
    const number = nextNumber();
    await accountWith(number);
    const response = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });
    expect(setsWelcomeBack(response)).toBe(false);
  });
});

describe("texts after the answer", () => {
  // Texts go through the default `runAfterAnswer`, which asks the platform to keep them alive.
  beforeEach(() => {
    setPlatform({
      databaseUrl: () => "",
      waitUntil: () => undefined,
      placeOf: () => ({ city: null, country: null }),
    });
  });

  it("answers a code request without waiting for the text to go", async () => {
    // A text service that never answers. The requests must not wait for it, or the time of the
    // answer would say whether the number has an account (only a free number gets a code, the others a notice).
    const stuck = createCaptureTexter();
    const never = () => new Promise<never>(() => undefined);
    const stuckAuth = createAuth({
      prisma: db(),
      secret: SECRET,
      baseURL: ORIGIN,
      mailer: capture,
      texter: { ...stuck, send: never, sendCode: never },
      cookies,
    });
    const taken = nextNumber();
    await accountWith(taken);

    const timeout = new Promise<"timed out">((resolve) =>
      setTimeout(() => {
        resolve("timed out");
      }, 5_000),
    );
    for (const [path, number] of [
      ["/phone-number/send-otp", nextNumber()],
      ["/phone-number/send-otp", taken],
      ["/phone-number/request-password-reset", taken],
    ] as const) {
      const answer = await Promise.race([
        stuckAuth.handler(
          new Request(`${ORIGIN}/api/auth${path}`, {
            method: "POST",
            headers: { "content-type": "application/json", origin: ORIGIN, "x-ruken-client-ip": nextIp() },
            body: JSON.stringify({ phoneNumber: number }),
          }),
        ),
        timeout,
      ]);
      expect(answer).not.toBe("timed out");
      expect((answer as Response).status).toBe(200);
    }
  });

  it("hands the text to the platform's waitUntil by default, so the Worker is not stopped with it half sent", async () => {
    const own = createCaptureTexter();
    const defaultAuth = createAuth({
      prisma: db(),
      secret: SECRET,
      baseURL: ORIGIN,
      mailer: capture,
      texter: own,
      cookies,
    });
    const number = nextNumber();
    const kept: Promise<unknown>[] = [];
    setPlatform({
      databaseUrl: () => "",
      waitUntil: (work) => {
        kept.push(work);
      },
      placeOf: () => ({ city: null, country: null }),
    });

    await defaultAuth.handler(
      new Request(`${ORIGIN}/api/auth/phone-number/send-otp`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, "x-ruken-client-ip": nextIp() },
        body: JSON.stringify({ phoneNumber: number }),
      }),
    );

    expect(kept).toHaveLength(1);
    await Promise.all(kept);
    expect(own.codes.map((code) => code.to)).toEqual([number]);
  });
});

describe("sessionInfo", () => {
  it("is null without a session cookie", async () => {
    expect(await sessionInfo(theAuth(), new Headers())).toBeNull();
  });

  it("hands back a fresh 30-day session cookie once the session is a day old, so active players stay signed in", async () => {
    const number = nextNumber();
    const userId = await accountWith(number);
    const signedIn = await post("/sign-in/phone-number", { phoneNumber: number, password: PASSWORD });
    const cookie = cookieHeaderFrom(signedIn);
    expect((await sessionInfo(theAuth(), new Headers({ cookie })))?.setCookies).toBeUndefined();

    // Two days later: BetterAuth decides from expiresAt, so move it back by two days.
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const row = await db().session.findFirstOrThrow({ where: { userId } });
    await db().session.update({
      where: { id: row.id },
      data: { expiresAt: new Date(row.expiresAt.getTime() - twoDaysMs) },
    });

    const info = await sessionInfo(theAuth(), new Headers({ cookie }));
    const refreshed = (info?.setCookies ?? []).find((line) =>
      line.startsWith(`${cookies.sessionCookieName}=`),
    );
    expect(refreshed).toMatch(/Max-Age=2592000/);
  });
});

// Kept so the unused import check does not trip while the mail type is only used for the member's reset email.
export type { Mailer };
