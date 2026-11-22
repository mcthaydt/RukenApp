import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, PUBLIC_ROUTE_HEADER, type Auth } from "../../../src/features/accounts/auth.ts";
import { cookiePolicy } from "../../../src/features/accounts/cookies.ts";
import {
  changePassword,
  type ChangeFormData,
  type CredentialDeps,
} from "../../../src/features/accounts/credentials.ts";
import type { FormEvent } from "../../../src/features/accounts/forms.ts";
import { FORM_MESSAGES } from "../../../src/features/accounts/forms.ts";
import { SIGN_IN_FAILURE_LIMIT } from "../../../src/features/accounts/sign-in-guard.ts";
import { createRateLimiter } from "../../../src/lib/server/rate-limit.ts";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import { createCaptureMailer } from "../../support/capture-mailer.ts";
import { createCaptureTexter } from "../../support/capture-texter.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Change password, for real: better-auth on the real schema in a throwaway Postgres, with the form's own function
// in front of it (src/features/accounts/credentials.ts). There is no "change email": nobody signs in with an email.

const ORIGIN = "http://localhost:5173";
const SECRET = "test_secret_that_is_at_least_32_chars";
const PASSWORD = "a long enough password";
const cookies = cookiePolicy(ORIGIN);

let database: TestDatabase | undefined;
let auth: Auth | undefined;
const clock = new TestClock("2026-11-21T12:00:00Z");
const background: Promise<void>[] = [];

function db(): PrismaClient {
  if (database === undefined) throw new Error("the database did not start");
  return database.prisma;
}
function theAuth(): Auth {
  if (auth === undefined) throw new Error("auth was not created");
  return auth;
}
async function settle(): Promise<void> {
  while (background.length > 0) await Promise.allSettled(background.splice(0));
}

function deps(): CredentialDeps {
  return {
    formDeps: { handler: (request) => theAuth().handler(request), baseURL: ORIGIN, cookies },
    prisma: db(),
    auth: theAuth(),
    secret: SECRET,
    limiter: createRateLimiter(db(), clock),
    guards: { db: db(), clock, secret: SECRET },
  };
}

beforeAll(async () => {
  database = await startTestDatabase();
  auth = createAuth({
    prisma: database.prisma,
    secret: SECRET,
    baseURL: ORIGIN,
    mailer: createCaptureMailer(),
    texter: createCaptureTexter(),
    cookies,
    clock,
    runInBackground: (task) => {
      background.push(task());
    },
  });
});

afterAll(async () => {
  await database?.stop();
});

let made = 0;
/** A new account with a number and a password, signed in once: its id, number and the session cookie a browser would hold. */
async function accountWithSession(): Promise<{ userId: string; number: string; cookie: string }> {
  made += 1;
  const number = `+1312558${String(made).padStart(4, "0")}`;
  const context = await theAuth().$context;
  const user = await db().user.create({
    data: {
      name: "Player",
      email: `${crypto.randomUUID()}@phone.ruken.invalid`,
      phoneNumber: number,
      phoneNumberVerified: true,
    },
  });
  await db().account.create({
    data: {
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await context.password.hash(PASSWORD),
    },
  });
  const signIn = await theAuth().handler(
    new Request(`${ORIGIN}/api/auth/sign-in/phone-number`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-ruken-client-ip": `198.51.100.${String(made)}`,
      },
      body: JSON.stringify({ phoneNumber: number, password: PASSWORD }),
    }),
  );
  await settle();
  expect(signIn.status).toBe(200);
  const cookie = signIn.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
  return { userId: user.id, number, cookie };
}

/** A form post as the route would hand it over. */
function formEvent(fields: Record<string, string>, cookie: string, address = "203.0.113.5"): FormEvent {
  return {
    request: new Request(`${ORIGIN}/me/x`, {
      method: "POST",
      headers: { cookie },
      body: new URLSearchParams(fields),
    }),
    cookies: { set: () => undefined, parse: () => ({ name: "", value: "" }) },
    getClientAddress: () => address,
  } as unknown as FormEvent;
}

function problem(answer: ChangeFormData | { data: ChangeFormData }): ChangeFormData {
  return "data" in answer ? answer.data : answer;
}

describe("change password", () => {
  it("changes the password, signs the other sessions out and keeps this one", async () => {
    const { userId, number, cookie } = await accountWithSession();
    await db().session.create({
      data: {
        userId,
        token: `other-${userId}`,
        expiresAt: new Date(clock.epochMs() + 86_400_000),
      },
    });
    const answer = await changePassword(
      formEvent({ password: PASSWORD, newPassword: "a brand new password" }, cookie),
      deps(),
      { userId, number },
    );
    expect(answer).toEqual({ done: true });
    // The old sessions are gone; one new one was made for this device.
    const sessions = await db().session.findMany({ where: { userId } });
    expect(sessions.map((s) => s.token)).not.toContain(`other-${userId}`);
    expect(sessions).toHaveLength(1);

    const signIn = (password: string): Promise<Response> =>
      theAuth().handler(
        new Request(`${ORIGIN}/api/auth/sign-in/phone-number`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            "x-ruken-client-ip": "203.0.113.77",
          },
          body: JSON.stringify({ phoneNumber: number, password }),
        }),
      );
    expect((await signIn("a brand new password")).status).toBe(200);
    expect((await signIn(PASSWORD)).status).toBe(401);
  });

  it("ends every computer's key, and only this maker's", async () => {
    const { userId, number, cookie } = await accountWithSession();
    const other = await accountWithSession();
    await db().computerKey.create({ data: { userId, name: "Laptop", keyHash: `hash-${userId}` } });
    await db().computerKey.create({
      data: { userId: other.userId, name: "Laptop", keyHash: `hash-${other.userId}` },
    });
    const answer = await changePassword(
      formEvent({ password: PASSWORD, newPassword: "a brand new password" }, cookie),
      deps(),
      { userId, number },
    );
    expect(answer).toEqual({ done: true });
    expect(await db().computerKey.count({ where: { userId } })).toBe(0);
    expect(await db().computerKey.count({ where: { userId: other.userId } })).toBe(1);
  });

  it("keeps the computers' keys when the new password is refused", async () => {
    const { userId, number, cookie } = await accountWithSession();
    await db().computerKey.create({ data: { userId, name: "Laptop", keyHash: `hash-${userId}` } });
    await changePassword(
      formEvent({ password: "wrong password here", newPassword: "a brand new password" }, cookie),
      deps(),
      {
        userId,
        number,
      },
    );
    expect(await db().computerKey.count({ where: { userId } })).toBe(1);
  });

  it("refuses a wrong current password and a new one that is too short, changing nothing", async () => {
    const { userId, number, cookie } = await accountWithSession();
    const wrong = await changePassword(
      formEvent({ password: "not my password", newPassword: "a brand new password" }, cookie),
      deps(),
      { userId, number },
    );
    expect(problem(wrong as { data: ChangeFormData })).toEqual({
      field: "password",
      error: FORM_MESSAGES.currentPasswordWrong,
    });
    const short = await changePassword(
      formEvent({ password: PASSWORD, newPassword: "short" }, cookie),
      deps(),
      { userId, number },
    );
    expect(problem(short as { data: ChangeFormData })).toEqual({
      field: "newPassword",
      error: FORM_MESSAGES.passwordLength,
    });
  });

  it("counts wrong passwords like sign-in does: 5 a minute from one address, and ten an hour pause the number", async () => {
    const { userId, number, cookie } = await accountWithSession();
    const wrongFrom = (address: string): Promise<unknown> =>
      changePassword(
        formEvent({ password: "nope", newPassword: "a brand new password" }, cookie, address),
        deps(),
        { userId, number },
      );
    // Five from one address pass the limit (and are refused as wrong); the sixth is "too many tries".
    for (let i = 0; i < 5; i += 1) await wrongFrom("198.51.100.200");
    const sixth = problem((await wrongFrom("198.51.100.200")) as { data: ChangeFormData });
    expect(sixth.error).toBe(FORM_MESSAGES.rateLimited);

    // Other addresses each get their own five, but the number's ten guesses an hour are shared.
    for (let i = 0; i < SIGN_IN_FAILURE_LIMIT - 5; i += 1) await wrongFrom(`198.51.100.${String(201 + i)}`);
    const paused = problem(
      await changePassword(
        formEvent({ password: PASSWORD, newPassword: "a brand new password" }, cookie, "198.51.100.250"),
        deps(),
        { userId, number },
      ),
    );
    // Even the right password is refused while the number is paused.
    expect(paused.error).toBe(FORM_MESSAGES.tooManyWrong);
  });

  it("does not work through the public /api/auth route, which does not ask for the current password", async () => {
    const { cookie } = await accountWithSession();
    const response = await theAuth().handler(
      new Request(`${ORIGIN}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          cookie,
          [PUBLIC_ROUTE_HEADER]: "1",
        },
        body: JSON.stringify({ currentPassword: PASSWORD, newPassword: "sneaky new password" }),
      }),
    );
    expect(response.status).toBe(404);
  });
});
