import { createHash } from "node:crypto";
import { isRedirect } from "@sveltejs/kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAuth,
  PUBLIC_ROUTE_HEADER,
  sessionInfo,
  type Auth,
} from "../../../src/features/accounts/auth.ts";
import { cookiePolicy, WELCOME_BACK_COOKIE } from "../../../src/features/accounts/cookies.ts";
import { signInWithPassword, type FormEvent } from "../../../src/features/accounts/forms.ts";
import {
  SIGN_IN_FAILURE_LIMIT,
  SIGN_IN_PAUSE_MS,
  SIGN_IN_WINDOW_MS,
} from "../../../src/features/accounts/sign-in-guard.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import type { MailMessage, Mailer } from "../../../src/lib/server/mail.ts";
import { setPlatform } from "../../../src/lib/server/platform.ts";
import { TestClock } from "../../support/test-clock.ts";
import { createCaptureMailer } from "../../support/capture-mailer.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";

// better-auth for real, on the real schema in a throwaway Postgres. These tests prove that our
// configuration fits the tables and behaves as the plan says. Every test signs in or up through
// better-auth, which hashes passwords with scrypt on purpose (slow by design); the postgres test
// project allows 30 seconds a test for that.

const ORIGIN = "http://localhost:5173";
const SECRET = "test_secret_that_is_at_least_32_chars";
const cookies = cookiePolicy(ORIGIN);

let database: TestDatabase | undefined;
let auth: Auth | undefined;
const capture = createCaptureMailer();
const mail: MailMessage[] = capture.sent;

/**
 * Mail goes out after the answer, through `runInBackground`. The tests hand every auth this runner,
 * and `post` waits for it, so a test still sees the mail a request sent.
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
    cookies,
    runInBackground,
  });
});

afterAll(async () => {
  await database?.stop();
});

// Each test signs up from its own address so the per-IP sign-up limit never gets in the way.
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  // Three numbers wide, so a long file of tests never runs past 254 and gets an address that is not valid.
  return `203.0.${String(Math.floor(ipCounter / 250))}.${String((ipCounter % 250) + 1)}`;
}

let emailCounter = 0;
function nextEmail(): string {
  emailCounter += 1;
  return `player${String(emailCounter)}@example.test`;
}

async function post(
  path: string,
  body: unknown,
  init: { ip?: string; cookie?: string; origin?: string } = {},
): Promise<Response> {
  const headers = new Headers({
    "content-type": "application/json",
    origin: init.origin ?? ORIGIN,
    "x-ruken-client-ip": init.ip ?? nextIp(),
  });
  if (init.cookie !== undefined) headers.set("cookie", init.cookie);
  const response = await theAuth().handler(
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

describe("sign-up with email and password", () => {
  it("refuses a sign-up sent straight to the public /api/auth route, which would skip the age step", async () => {
    const email = nextEmail();
    const headers = new Headers({
      "content-type": "application/json",
      origin: ORIGIN,
      "x-ruken-client-ip": nextIp(),
      // The public route sets this on every request it passes on (forward.ts); the sign-up form's own call does not.
      [PUBLIC_ROUTE_HEADER]: "1",
    });
    const response = await theAuth().handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email, password: "correct horse", name: "Player" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await db().user.count({ where: { email } })).toBe(0);
  });

  it("stores the account on our tables: a cuid2 id, a session, and a cookie a script cannot read", async () => {
    const email = nextEmail();
    const response = await post("/sign-up/email", { email, password: "correct horse", name: "Player" });
    expect(response.status).toBe(200);

    const user = await db().user.findUniqueOrThrow({ where: { email } });
    expect(user.id).toMatch(/^[a-z][a-z0-9]{23}$/);
    expect(user.status).toBe("active");
    expect(await db().session.count({ where: { userId: user.id } })).toBe(1);

    const setCookie = response.headers.getSetCookie().join("\n");
    expect(setCookie).toContain("rk_session=");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it("refuses a password shorter than 10 or longer than 128 characters", async () => {
    for (const password of ["a".repeat(9), "a".repeat(129)]) {
      const email = nextEmail();
      const response = await post("/sign-up/email", { email, password, name: "Player" });
      expect(response.status).toBe(400);
      expect(await db().user.count({ where: { email } })).toBe(0);
    }
    expect(
      (await post("/sign-up/email", { email: nextEmail(), password: "a".repeat(128), name: "Player" }))
        .status,
    ).toBe(200);
  });
});

describe("sign-in with email and password", () => {
  it("returns a session cookie that resolves to the signed-in user", async () => {
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Player" });

    const response = await post("/sign-in/email", { email, password: "correct horse" });
    expect(response.status).toBe(200);

    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    const user = await db().user.findUniqueOrThrow({ where: { email } });
    expect(info).toEqual({ sessionId: expect.any(String) as string, userId: user.id, userStatus: "active" });
  });

  it("refuses a wrong password", async () => {
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    expect((await post("/sign-in/email", { email, password: "wrong horse!" })).status).toBe(401);
  });

  it("limits quick attempts for one email from one client address", async () => {
    const ip = nextIp();
    const email = nextEmail();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      statuses.push((await post("/sign-in/email", { email, password: "wrong horse!" }, { ip })).status);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
    // Another address from the same client, and the same address from another client, still get an answer.
    expect(
      (await post("/sign-in/email", { email: nextEmail(), password: "wrong horse!" }, { ip })).status,
    ).toBe(401);
    expect((await post("/sign-in/email", { email, password: "wrong horse!" })).status).toBe(401);
    // The counter is kept under the keyed hash of the address, never the address itself.
    const keys = (
      await db().rateLimit.findMany({ where: { key: { contains: ip } }, select: { key: true } })
    ).map((row) => row.key);
    expect(keys.join("\n")).not.toContain("@");
  });

  it("still stops one client address trying many addresses quickly, at a wider limit", async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 31; attempt += 1)
      statuses.push(
        (await post("/sign-in/email", { email: nextEmail(), password: "wrong horse!" }, { ip })).status,
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
      secret: "test_secret_that_is_at_least_32_chars",
      baseURL: HTTPS_ORIGIN,
      mailer: { send: () => Promise.resolve(true) },
      cookies: httpsCookies,
      runInBackground,
    });
  });

  function theHttpsAuth(): Auth {
    if (httpsAuth === undefined) throw new Error("the https auth was not created");
    return httpsAuth;
  }

  it("sets __Host-rk_session with Secure, HttpOnly, SameSite=Lax, Path=/ and no Domain at sign-up", async () => {
    const response = await theHttpsAuth().handler(
      new Request(`${HTTPS_ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: HTTPS_ORIGIN, "x-ruken-client-ip": nextIp() },
        body: JSON.stringify({ email: nextEmail(), password: "correct horse", name: "Pat" }),
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
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Player" });
    const set = vi.fn();
    const event = {
      request: new Request(`${HTTPS_ORIGIN}/sign-in`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email, password: "correct horse", next: "/" }),
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

describe("email verification", () => {
  it("sends one verification link at sign-up, and the account starts unverified", async () => {
    mail.length = 0;
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });

    expect(mail).toHaveLength(1);
    expect(mail[0]).toMatchObject({ to: email, subject: "Confirm your email for Ruken" });
    expect(mail[0]?.text).toContain(`${ORIGIN}/api/auth/verify-email?token=`);
    expect((await db().user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false);
  });

  it("marks the email verified when the link is followed, then goes home", async () => {
    mail.length = 0;
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    const link = /https?:\/\/\S+/.exec(mail[0]?.text ?? "")?.[0] ?? "";

    const followed = await theAuth().handler(
      new Request(link, { headers: { "x-ruken-client-ip": nextIp() } }),
    );
    expect(followed.status).toBe(302);
    expect(followed.headers.get("location")).toBe("/");
    expect((await db().user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
  });

  it("limits resending the link from one address", async () => {
    const email = nextEmail();
    const ip = nextIp();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" }, { ip });
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1)
      statuses.push((await post("/send-verification-email", { email }, { ip })).status);
    expect(statuses).toEqual([200, 200, 200, 429]);
  });
});

describe("password reset", () => {
  /** The reset mails sent to this address so far, newest last. */
  function resetMailsTo(email: string): MailMessage[] {
    return mail.filter((message) => message.to === email && message.subject === "Reset your Ruken password");
  }

  /** Follows the link in a reset mail, as the browser does, and returns the token it lands on the new-password page with. */
  async function tokenFromMail(message: MailMessage | undefined): Promise<string> {
    const link = /https?:\/\/\S+/.exec(message?.text ?? "")?.[0] ?? "";
    const followed = await theAuth().handler(
      new Request(link, { headers: { "x-ruken-client-ip": nextIp() } }),
    );
    expect(followed.status).toBe(302);
    const landed = new URL(followed.headers.get("location") ?? "", ORIGIN);
    expect(landed.pathname).toBe("/reset-password");
    return landed.searchParams.get("token") ?? "";
  }

  async function signUp(): Promise<{ email: string; cookie: string }> {
    const email = nextEmail();
    const signedUp = await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    return { email, cookie: cookieHeaderFrom(signedUp) };
  }

  /**
   * Makes a reset link expire. The row is stored under the SHA-256 of `reset-password:<token>`
   * (base64url), BetterAuth's "hashed" identifier, so the test hashes it the same way.
   */
  async function expireResetToken(token: string): Promise<void> {
    const identifier = createHash("sha256").update(`reset-password:${token}`).digest("base64url");
    const { count } = await db().verification.updateMany({
      where: { identifier },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(count).toBe(1);
  }

  function requestReset(email: string, ip?: string): Promise<Response> {
    return post(
      "/request-password-reset",
      { email, redirectTo: "/reset-password" },
      ip === undefined ? {} : { ip },
    );
  }

  it("mails a link to an existing account that opens the new-password page with a token", async () => {
    const { email } = await signUp();
    mail.length = 0;

    expect((await requestReset(email)).status).toBe(200);

    expect(resetMailsTo(email)).toHaveLength(1);
    expect(resetMailsTo(email)[0]?.text).toContain("expires in an hour");
    expect(await tokenFromMail(resetMailsTo(email)[0])).not.toBe("");
  });

  it("stores only a hash of the reset token, so a copy of the database cannot reset the password", async () => {
    const { email } = await signUp();
    mail.length = 0;
    await requestReset(email);
    const token = await tokenFromMail(resetMailsTo(email)[0]);

    expect(
      await db().verification.count({
        where: { OR: [{ identifier: { contains: token } }, { value: { contains: token } }] },
      }),
    ).toBe(0);
    expect((await post("/reset-password", { newPassword: "a brand new horse", token })).status).toBe(200);
  });

  it("answers the same for an address with no account, and sends nothing", async () => {
    const { email } = await signUp();
    const unknown = nextEmail();
    mail.length = 0;

    const known = await requestReset(email);
    const stranger = await requestReset(unknown);

    expect(stranger.status).toBe(known.status);
    expect(await stranger.json()).toEqual(await known.json());
    expect(resetMailsTo(unknown)).toHaveLength(0);
    expect(await db().user.count({ where: { email: unknown } })).toBe(0);
  });

  it("allows three requests for one address in 15 minutes from one client address, with or without an account, and mails three links", async () => {
    const { email } = await signUp();
    const stranger = nextEmail();
    mail.length = 0;

    for (const address of [email, stranger]) {
      const ip = nextIp();
      const statuses: number[] = [];
      for (let request = 0; request < 4; request += 1)
        statuses.push((await requestReset(address, ip)).status);
      expect(statuses).toEqual([200, 200, 200, 429]);
    }
    expect(resetMailsTo(email)).toHaveLength(3);
  });

  it("still mails the person a reset link after a stranger used up the address's limit from other addresses", async () => {
    const { email } = await signUp();
    for (const ip of [nextIp(), nextIp()]) {
      for (let request = 0; request < 4; request += 1) await requestReset(email, ip);
    }
    mail.length = 0;

    expect((await requestReset(email)).status).toBe(200);
    expect(resetMailsTo(email)).toHaveLength(1);
  });

  it("allows thirty reset requests for one address an hour across all client addresses", async () => {
    const email = nextEmail();
    const statuses: number[] = [];
    for (let ip = 0; ip < 11; ip += 1) {
      const address = nextIp();
      for (let request = 0; request < 3; request += 1)
        statuses.push((await requestReset(email, address)).status);
    }
    expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429, 429]);
  });

  it("allows ten reset requests an hour from one client address", async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let request = 0; request < 11; request += 1)
      statuses.push((await requestReset(nextEmail(), ip)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("sets the new password once, signs every session out, and mails a notice", async () => {
    const { email, cookie } = await signUp();
    const otherDevice = cookieHeaderFrom(await post("/sign-in/email", { email, password: "correct horse" }));
    mail.length = 0;
    await requestReset(email);
    const token = await tokenFromMail(resetMailsTo(email)[0]);

    const reset = await post("/reset-password", { newPassword: "a brand new horse", token });
    expect(reset.status).toBe(200);

    expect(await sessionInfo(theAuth(), new Headers({ cookie }))).toBeNull();
    expect(await sessionInfo(theAuth(), new Headers({ cookie: otherDevice }))).toBeNull();
    expect((await post("/sign-in/email", { email, password: "correct horse" })).status).toBe(401);
    expect((await post("/sign-in/email", { email, password: "a brand new horse" })).status).toBe(200);
    expect(
      mail.filter((message) => message.to === email && message.subject === "Your Ruken password was changed"),
    ).toHaveLength(1);

    const again = await post("/reset-password", { newPassword: "yet another horse", token });
    expect(again.status).toBe(400);
  });

  it("does not sign the person in by itself", async () => {
    const { email } = await signUp();
    mail.length = 0;
    await requestReset(email);
    const token = await tokenFromMail(resetMailsTo(email)[0]);

    const reset = await post("/reset-password", { newPassword: "a brand new horse", token });

    expect(reset.headers.getSetCookie().some((line) => line.startsWith(cookies.sessionCookieName))).toBe(
      false,
    );
  });

  it("refuses a short or too long new password and leaves the link usable", async () => {
    const { email } = await signUp();
    mail.length = 0;
    await requestReset(email);
    const token = await tokenFromMail(resetMailsTo(email)[0]);

    expect((await post("/reset-password", { newPassword: "too short", token })).status).toBe(400);
    expect((await post("/reset-password", { newPassword: "x".repeat(129), token })).status).toBe(400);
    expect((await post("/sign-in/email", { email, password: "correct horse" })).status).toBe(200);

    expect((await post("/reset-password", { newPassword: "a brand new horse", token })).status).toBe(200);
  });

  it("refuses a made-up token, and an expired one", async () => {
    expect(
      (await post("/reset-password", { newPassword: "a brand new horse", token: "made-up-token" })).status,
    ).toBe(400);

    const { email } = await signUp();
    mail.length = 0;
    await requestReset(email);
    const token = await tokenFromMail(resetMailsTo(email)[0]);
    await expireResetToken(token);

    expect((await post("/reset-password", { newPassword: "a brand new horse", token })).status).toBe(400);
  });

  it("sends the link back to the new-password page with an error when it has expired", async () => {
    const { email } = await signUp();
    mail.length = 0;
    await requestReset(email);
    const link = /https?:\/\/\S+/.exec(resetMailsTo(email)[0]?.text ?? "")?.[0] ?? "";
    const token = await tokenFromMail(resetMailsTo(email)[0]);
    await expireResetToken(token);

    const followed = await theAuth().handler(
      new Request(link, { headers: { "x-ruken-client-ip": nextIp() } }),
    );

    expect(followed.headers.get("location")).toBe(`${ORIGIN}/reset-password?error=INVALID_TOKEN`);
  });
});

/** A nodemailer-style error for a recipient the mail server refused. Its message holds the address. */
function recipientRejected(to: string): Error {
  const error = new Error(
    `Can't send mail - all recipients were rejected: 550 5.1.1 <${to}>: Recipient address rejected`,
  );
  return Object.assign(error, { code: "EENVELOPE", responseCode: 550 });
}

describe("account sign-in pause", () => {
  // A second auth with its own clock, so an hour passes in a line, and its own mail and log.
  const clock = new TestClock("2026-10-23T12:00:00Z");
  const sent: MailMessage[] = [];
  const logged: string[] = [];
  let mailFails = false;
  let pauseAuth: Auth | undefined;

  beforeAll(() => {
    const mailer: Mailer = {
      send: (message) => {
        // As nodemailer fails when the relay refuses the recipient: the server's reply, with the
        // address in it, is part of the message.
        if (mailFails) return Promise.reject(recipientRejected(message.to));
        sent.push(message);
        return Promise.resolve(true);
      },
    };
    pauseAuth = createAuth({
      prisma: db(),
      secret: "test_secret_that_is_at_least_32_chars",
      baseURL: ORIGIN,
      mailer,
      cookies,
      clock,
      log: (message) => logged.push(message),
      runInBackground,
    });
  });

  async function postPause(path: string, body: unknown): Promise<Response> {
    const headers = new Headers({
      "content-type": "application/json",
      origin: ORIGIN,
      "x-ruken-client-ip": nextIp(),
    });
    const response = await (pauseAuth ?? theAuth()).handler(
      new Request(`${ORIGIN}/api/auth${path}`, { method: "POST", headers, body: JSON.stringify(body) }),
    );
    await settleBackground();
    return response;
  }

  const signIn = (email: string, password: string) => postPause("/sign-in/email", { email, password });

  async function accountWithPassword(): Promise<string> {
    const email = nextEmail();
    expect(
      (await postPause("/sign-up/email", { email, password: "correct horse", name: "Pat" })).status,
    ).toBe(200);
    return email;
  }

  async function failTimes(email: string, count: number): Promise<void> {
    for (let index = 0; index < count; index += 1)
      expect((await signIn(email, "wrong horse")).status).toBe(401);
  }

  const noticesTo = (email: string) =>
    sent.filter(
      (message) =>
        message.to === email && message.subject === "Password sign-in on your Ruken account is paused",
    );

  it("refuses the right password too, for an hour, after ten wrong ones", async () => {
    const email = await accountWithPassword();

    await failTimes(email, SIGN_IN_FAILURE_LIMIT);

    const refused = await signIn(email, "correct horse");
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: "SIGN_IN_PAUSED" });
    expect(refused.headers.getSetCookie()).toEqual([]);
  });

  it("still lets the nine-times-wrong address in with the right password", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(email, "correct horse")).status).toBe(200);
  });

  it("answers exactly the same for an address with no account", async () => {
    const known = await accountWithPassword();
    const stranger = nextEmail();
    await failTimes(known, SIGN_IN_FAILURE_LIMIT);
    await failTimes(stranger, SIGN_IN_FAILURE_LIMIT);

    const first = await signIn(known, "correct horse");
    const second = await signIn(stranger, "correct horse");

    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
  });

  it("counts the same address in any letter case", async () => {
    const email = await accountWithPassword();
    for (let index = 0; index < SIGN_IN_FAILURE_LIMIT; index += 1) {
      await signIn(index % 2 === 0 ? email.toUpperCase() : email, "wrong horse");
    }

    expect((await signIn(email, "correct horse")).status).toBe(429);
  });

  it("lets the right password in again when the hour is over", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT);
    clock.advance(SIGN_IN_PAUSE_MS - 1);
    expect((await signIn(email, "correct horse")).status).toBe(429);

    clock.advance(1);

    expect((await signIn(email, "correct horse")).status).toBe(200);
  });

  it("does not add up failures from different hours", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);
    clock.advance(SIGN_IN_WINDOW_MS);
    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(email, "correct horse")).status).toBe(200);
  });

  it("forgets earlier failures after a correct password", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);
    expect((await signIn(email, "correct horse")).status).toBe(200);

    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);

    expect((await signIn(email, "correct horse")).status).toBe(200);
  });

  it("leaves the reset request working while paused", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT);
    sent.length = 0;

    expect(
      (await postPause("/request-password-reset", { email, redirectTo: "/reset-password" })).status,
    ).toBe(200);

    expect(sent.map((message) => message.subject)).toEqual(
      expect.arrayContaining(["Reset your Ruken password"]),
    );
  });

  it("is lifted by a finished password reset", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT);
    sent.length = 0;
    await postPause("/request-password-reset", { email, redirectTo: "/reset-password" });
    const link =
      /https?:\/\/\S+/.exec(
        sent.find((message) => message.subject === "Reset your Ruken password")?.text ?? "",
      )?.[0] ?? "";
    const followed = await (pauseAuth ?? theAuth()).handler(
      new Request(link, { headers: { "x-ruken-client-ip": nextIp() } }),
    );
    const token = new URL(followed.headers.get("location") ?? "", ORIGIN).searchParams.get("token") ?? "";

    expect((await postPause("/reset-password", { newPassword: "a brand new horse", token })).status).toBe(
      200,
    );

    expect((await signIn(email, "a brand new horse")).status).toBe(200);
  });

  it("mails the account one notice when the pause starts, and nobody else", async () => {
    const email = await accountWithPassword();
    const stranger = nextEmail();
    sent.length = 0;

    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);
    await failTimes(stranger, SIGN_IN_FAILURE_LIMIT);
    expect(noticesTo(email)).toHaveLength(0);
    await failTimes(email, 1);

    await vi.waitFor(() => {
      expect(noticesTo(email)).toHaveLength(1);
    });
    expect(noticesTo(email)[0]?.text).toContain("an hour");
    await signIn(email, "correct horse");
    expect(noticesTo(email)).toHaveLength(1);
    expect(sent.filter((message) => message.to === stranger)).toHaveLength(0);
  });

  it("still answers a wrong password the usual way when the notice cannot be mailed, and logs it", async () => {
    const email = await accountWithPassword();
    await failTimes(email, SIGN_IN_FAILURE_LIMIT - 1);
    mailFails = true;
    try {
      expect((await signIn(email, "wrong horse")).status).toBe(401);
      await vi.waitFor(() => {
        expect(logged).toContain("sign-in pause notice not sent: EENVELOPE 550");
      });
    } finally {
      mailFails = false;
    }
    expect((await signIn(email, "correct horse")).status).toBe(429);
    expect(logged.join("\n")).not.toContain(email);
  });

  it("logs a confirmation mail that could not be sent by its code, never the address, and still makes the account", async () => {
    const email = nextEmail();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mailFails = true;
    try {
      expect(
        (await postPause("/sign-up/email", { email, password: "correct horse", name: "Pat" })).status,
      ).toBe(200);
    } finally {
      mailFails = false;
    }
    const printed = consoleError.mock.calls
      .flat()
      .map((part) => (part instanceof Error ? part.message : String(part)));
    consoleError.mockRestore();

    expect(logged).toContain("email confirmation mail not sent: EENVELOPE 550");
    expect([...logged, ...printed].join("\n")).not.toContain(email);
    expect(await db().user.count({ where: { email } })).toBe(1);
  });

  it("does not count a failed sign-up, a bad link or a made-up body as a wrong password", async () => {
    const email = await accountWithPassword();

    for (let index = 0; index < SIGN_IN_FAILURE_LIMIT; index += 1) {
      await postPause("/sign-up/email", { email, password: "correct horse", name: "Pat" });
      await postPause("/sign-in/email", { password: "wrong horse" });
      // A body BetterAuth refuses (400) was counted before the check and is given back after it.
      expect((await postPause("/sign-in/email", { email })).status).toBe(400);
    }

    expect((await signIn(email, "correct horse")).status).toBe(200);
  });

  it("checks no more than ten passwords when thirty arrive at once from thirty client addresses", async () => {
    const email = await accountWithPassword();

    const answers = await Promise.all(Array.from({ length: 30 }, () => signIn(email, "wrong horse")));
    const statuses = answers.map((answer) => answer.status);

    expect(statuses.filter((status) => status === 401)).toHaveLength(SIGN_IN_FAILURE_LIMIT);
    expect(statuses.filter((status) => status === 429)).toHaveLength(30 - SIGN_IN_FAILURE_LIMIT);
    expect((await signIn(email, "correct horse")).status).toBe(429);
  });

  it("signs every device out after a reset even when the changed-password mail cannot be sent, and logs it", async () => {
    const email = await accountWithPassword();
    const signedIn = await signIn(email, "correct horse");
    const cookie = cookieHeaderFrom(signedIn);
    sent.length = 0;
    await postPause("/request-password-reset", { email, redirectTo: "/reset-password" });
    const link =
      /https?:\/\/\S+/.exec(
        sent.find((message) => message.subject === "Reset your Ruken password")?.text ?? "",
      )?.[0] ?? "";
    const followed = await (pauseAuth ?? theAuth()).handler(
      new Request(link, { headers: { "x-ruken-client-ip": nextIp() } }),
    );
    const token = new URL(followed.headers.get("location") ?? "", ORIGIN).searchParams.get("token") ?? "";

    mailFails = true;
    try {
      expect((await postPause("/reset-password", { newPassword: "a brand new horse", token })).status).toBe(
        200,
      );
    } finally {
      mailFails = false;
    }

    expect(await sessionInfo(pauseAuth ?? theAuth(), new Headers({ cookie }))).toBeNull();
    expect(logged).toContain("password changed notice not sent: EENVELOPE 550");
    expect(logged.join("\n")).not.toContain(email);
    expect((await signIn(email, "a brand new horse")).status).toBe(200);
  });
});

describe("signing in while a deletion waits", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** Signs up, then asks to delete the account, with the purge `purgeInDays` days away (negative: already past). */
  async function deletingAccount(purgeInDays: number) {
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    const user = await db().user.update({ where: { email }, data: { status: "pending_deletion" } });
    await db().session.deleteMany({ where: { userId: user.id } });
    // The hook reads the real clock, so the dates are relative to now.
    const now = Date.now();
    await db().deletionRequest.create({
      data: {
        userId: user.id,
        requestedAt: new Date(now - 15 * DAY_MS),
        purgeAfter: new Date(now + purgeInDays * DAY_MS),
      },
    });
    return { email, userId: user.id };
  }

  const setsWelcomeBack = (response: Response) =>
    response.headers.getSetCookie().some((line) => line.startsWith(`${WELCOME_BACK_COOKIE}=1;`));

  it("restores the account within the 14 days and flags the welcome back", async () => {
    const { email, userId } = await deletingAccount(7);
    const response = await post("/sign-in/email", { email, password: "correct horse" });

    expect(response.status).toBe(200);
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).status).toBe("active");
    expect(setsWelcomeBack(response)).toBe(true);
    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    expect(info?.userStatus).toBe("active");
  });

  it("flags the welcome back for a cookie a script cannot read, short-lived, on the whole site", async () => {
    const { email } = await deletingAccount(7);
    const response = await post("/sign-in/email", { email, password: "correct horse" });

    const line = response.headers
      .getSetCookie()
      .find((setCookie) => setCookie.startsWith(`${WELCOME_BACK_COOKIE}=`));
    expect(line).toMatch(/Max-Age=300/);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
  });

  it("keeps an account whose 14 days are over signed out, and flags nothing", async () => {
    const { email } = await deletingAccount(-1);
    const response = await post("/sign-in/email", { email, password: "correct horse" });

    expect(setsWelcomeBack(response)).toBe(false);
    const info = await sessionInfo(theAuth(), new Headers({ cookie: cookieHeaderFrom(response) }));
    expect(info?.userStatus).toBe("pending_deletion");
  });

  it("flags nothing for an ordinary sign-in", async () => {
    const email = nextEmail();
    await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    const response = await post("/sign-in/email", { email, password: "correct horse" });
    expect(setsWelcomeBack(response)).toBe(false);
  });
});

describe("mail after the answer", () => {
  // Mail goes through the default `runAfterAnswer`, which asks the platform to keep it alive.
  beforeEach(() => {
    setPlatform({ databaseUrl: () => "", waitUntil: () => undefined });
  });

  it("answers a reset request without waiting for the mail to go", async () => {
    // A mail server that never answers. The requests must not wait for it, or the time of the
    // answer would say whether the address has an account (only real accounts get mail).
    const stuck: Mailer = { send: () => new Promise<boolean>(() => undefined) };
    const stuckAuth = createAuth({
      prisma: db(),
      secret: "test_secret_that_is_at_least_32_chars",
      baseURL: ORIGIN,
      mailer: stuck,
      cookies,
    });
    const email = nextEmail();
    const call = (path: string, body: unknown) =>
      stuckAuth.handler(
        new Request(`${ORIGIN}/api/auth${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: ORIGIN, "x-ruken-client-ip": nextIp() },
          body: JSON.stringify(body),
        }),
      );
    // Signing up sends the confirmation mail, which this mail server would never finish, so the account is made directly.
    await db().user.create({ data: { email, name: "Pat", emailVerified: true } });

    const timeout = new Promise<"timed out">((resolve) =>
      setTimeout(() => {
        resolve("timed out");
      }, 5_000),
    );
    const reset = await Promise.race([
      call("/request-password-reset", { email, redirectTo: "/reset-password" }),
      timeout,
    ]);

    expect(reset).not.toBe("timed out");
    expect((reset as Response).status).toBe(200);
  });

  it("hands the mail to the platform's waitUntil by default, so the Worker is not stopped with it half sent", async () => {
    const sent: MailMessage[] = [];
    const mailer: Mailer = {
      send: (message) => {
        sent.push(message);
        return Promise.resolve(true);
      },
    };
    const defaultAuth = createAuth({
      prisma: db(),
      secret: "test_secret_that_is_at_least_32_chars",
      baseURL: ORIGIN,
      mailer,
      cookies,
    });
    const email = nextEmail();
    await db().user.create({ data: { email, name: "Pat", emailVerified: true } });
    const kept: Promise<unknown>[] = [];
    setPlatform({
      databaseUrl: () => "",
      waitUntil: (work) => {
        kept.push(work);
      },
    });

    await defaultAuth.handler(
      new Request(`${ORIGIN}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN, "x-ruken-client-ip": nextIp() },
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
      }),
    );

    expect(kept).toHaveLength(1);
    await Promise.all(kept);
    expect(sent.map((message) => message.to)).toEqual([email]);
  });
});

describe("sessionInfo", () => {
  it("is null without a session cookie", async () => {
    expect(await sessionInfo(theAuth(), new Headers())).toBeNull();
  });

  it("hands back a fresh 30-day session cookie once the session is a day old, so active players stay signed in", async () => {
    const email = nextEmail();
    const signedUp = await post("/sign-up/email", { email, password: "correct horse", name: "Pat" });
    const cookie = cookieHeaderFrom(signedUp);
    expect((await sessionInfo(theAuth(), new Headers({ cookie })))?.setCookies).toBeUndefined();

    // Two days later: BetterAuth decides from expiresAt, so move it back by two days.
    const user = await db().user.findUniqueOrThrow({ where: { email } });
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const row = await db().session.findFirstOrThrow({ where: { userId: user.id } });
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
