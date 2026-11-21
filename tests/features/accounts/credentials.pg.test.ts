import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAuth, PUBLIC_ROUTE_HEADER, type Auth } from "../../../src/features/accounts/auth.ts";
import { cookiePolicy } from "../../../src/features/accounts/cookies.ts";
import {
  changeEmail,
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
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

// Change email and change password, for real: better-auth on the real schema in a throwaway Postgres, with the
// forms' own functions in front of it (src/features/accounts/credentials.ts).

const ORIGIN = "http://localhost:5173";
const SECRET = "test_secret_that_is_at_least_32_chars";
const PASSWORD = "a long enough password";
const cookies = cookiePolicy(ORIGIN);

let database: TestDatabase | undefined;
let auth: Auth | undefined;
const capture = createCaptureMailer();
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
    mailer: capture,
    auth: theAuth(),
    limiter: createRateLimiter(db(), clock),
    guards: { db: db(), clock, secret: SECRET },
    runInBackground: (task) => {
      background.push(task());
    },
  };
}

beforeAll(async () => {
  database = await startTestDatabase();
  auth = createAuth({
    prisma: database.prisma,
    secret: SECRET,
    baseURL: ORIGIN,
    mailer: capture,
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
/** A new account, signed in once: its id, address and the session cookie a browser would hold. */
async function accountWithSession(): Promise<{ userId: string; email: string; cookie: string }> {
  made += 1;
  const email = `change${String(made)}@example.test`;
  const signUp = await theAuth().handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-ruken-client-ip": `198.51.100.${String(made)}`,
      },
      body: JSON.stringify({ email, password: PASSWORD, name: "Player" }),
    }),
  );
  await settle();
  const body = await signUp.json<{ user: { id: string } }>();
  const cookie = signUp.headers
    .getSetCookie()
    .map((line) => line.split(";")[0] ?? "")
    .join("; ");
  return { userId: body.user.id, email, cookie };
}

/** A form post as the route would hand it over. `jar` collects the cookies the answer sets. */
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

describe("change email", () => {
  it("mails a link to the new address, tells the old one, and changes the address only when the link is opened", async () => {
    const { userId, email, cookie } = await accountWithSession();
    capture.sent.length = 0;
    const answer = await changeEmail(
      formEvent({ email: "New.Address@example.test", password: PASSWORD }, cookie),
      deps(),
      { userId, email },
    );
    await settle();
    expect(answer).toEqual({ sentTo: "new.address@example.test" });

    const toNew = capture.sent.find((mail) => mail.to === "new.address@example.test");
    expect(toNew?.subject).toBe("Confirm your new email for Ruken");
    expect(capture.sent.find((mail) => mail.to === email)?.subject).toBe(
      "A new email was asked for on your Ruken account",
    );
    // Until the link is opened, the account keeps its address.
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(email);

    const link = toNew?.text.split("\n").find((line) => line.startsWith("http"));
    if (link === undefined) throw new Error("the mail held no link");
    const opened = await theAuth().handler(new Request(link, { headers: { cookie, origin: ORIGIN } }));
    expect([200, 302]).toContain(opened.status);
    const after = await db().user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.email).toBe("new.address@example.test");
    expect(after.emailVerified).toBe(true);
  });

  it("refuses a wrong current password beside the field, and changes and mails nothing", async () => {
    const { userId, email, cookie } = await accountWithSession();
    capture.sent.length = 0;
    const answer = await changeEmail(
      formEvent({ email: "other@example.test", password: "not my password" }, cookie),
      deps(),
      { userId, email },
    );
    await settle();
    expect(problem(answer as { data: ChangeFormData })).toEqual({
      field: "password",
      error: FORM_MESSAGES.currentPasswordWrong,
    });
    expect(capture.sent).toHaveLength(0);
  });

  it("answers the same for an address another account has, and sends no link that can take it", async () => {
    const taken = await accountWithSession();
    const me = await accountWithSession();
    capture.sent.length = 0;
    const answer = await changeEmail(
      formEvent({ email: taken.email, password: PASSWORD }, me.cookie),
      deps(),
      { userId: me.userId, email: me.email },
    );
    await settle();
    expect(answer).toEqual({ sentTo: taken.email });
    expect(capture.sent.filter((mail) => mail.subject === "Confirm your new email for Ruken")).toHaveLength(
      0,
    );
    expect((await db().user.findUniqueOrThrow({ where: { id: me.userId } })).email).toBe(me.email);
  });

  it("refuses the address the account already has, and one that is not an address", async () => {
    const { userId, email, cookie } = await accountWithSession();
    const same = await changeEmail(formEvent({ email, password: PASSWORD }, cookie), deps(), {
      userId,
      email,
    });
    expect(problem(same as { data: ChangeFormData }).error).toBe(FORM_MESSAGES.sameEmail);
    const bad = await changeEmail(formEvent({ email: "nope", password: PASSWORD }, cookie), deps(), {
      userId,
      email,
    });
    expect(problem(bad as { data: ChangeFormData }).error).toBe(FORM_MESSAGES.emailInvalid);
  });

  it("does not work through the public /api/auth route, which does not ask for the password", async () => {
    const { cookie } = await accountWithSession();
    const response = await theAuth().handler(
      new Request(`${ORIGIN}/api/auth/change-email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          cookie,
          [PUBLIC_ROUTE_HEADER]: "1",
        },
        body: JSON.stringify({ newEmail: "sneaky@example.test" }),
      }),
    );
    expect(response.status).toBe(404);
  });

  it("an open change link does nothing once the account is gone", async () => {
    const { userId, email, cookie } = await accountWithSession();
    capture.sent.length = 0;
    await changeEmail(formEvent({ email: "late@example.test", password: PASSWORD }, cookie), deps(), {
      userId,
      email,
    });
    await settle();
    const link = capture.sent
      .find((mail) => mail.to === "late@example.test")
      ?.text.split("\n")
      .find((line) => line.startsWith("http"));
    if (link === undefined) throw new Error("the mail held no link");
    // What the purge does to the address (deletion.ts): the row keeps a tombstone address.
    await db().user.update({ where: { id: userId }, data: { email: `purged-${userId}@deleted.invalid` } });
    await theAuth().handler(new Request(link, { headers: { origin: ORIGIN } }));
    expect((await db().user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(
      `purged-${userId}@deleted.invalid`,
    );
  });
});

describe("change password", () => {
  it("changes the password, signs the other sessions out and keeps this one", async () => {
    const { userId, email, cookie } = await accountWithSession();
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
      { userId, email },
    );
    expect(answer).toEqual({ done: true });
    // The old sessions are gone; one new one was made for this device.
    const sessions = await db().session.findMany({ where: { userId } });
    expect(sessions.map((s) => s.token)).not.toContain(`other-${userId}`);
    expect(sessions).toHaveLength(1);

    const signIn = (password: string): Promise<Response> =>
      theAuth().handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: ORIGIN,
            "x-ruken-client-ip": "203.0.113.77",
          },
          body: JSON.stringify({ email, password }),
        }),
      );
    expect((await signIn("a brand new password")).status).toBe(200);
    expect((await signIn(PASSWORD)).status).toBe(401);
  });

  it("refuses a wrong current password and a new one that is too short, changing nothing", async () => {
    const { userId, email, cookie } = await accountWithSession();
    const wrong = await changePassword(
      formEvent({ password: "not my password", newPassword: "a brand new password" }, cookie),
      deps(),
      { userId, email },
    );
    expect(problem(wrong as { data: ChangeFormData })).toEqual({
      field: "password",
      error: FORM_MESSAGES.currentPasswordWrong,
    });
    const short = await changePassword(
      formEvent({ password: PASSWORD, newPassword: "short" }, cookie),
      deps(),
      {
        userId,
        email,
      },
    );
    expect(problem(short as { data: ChangeFormData })).toEqual({
      field: "newPassword",
      error: FORM_MESSAGES.passwordLength,
    });
  });

  it("counts wrong passwords like sign-in does: 5 a minute from one address, and ten an hour pause the account", async () => {
    const { userId, email, cookie } = await accountWithSession();
    const wrongFrom = (address: string): Promise<unknown> =>
      changePassword(
        formEvent({ password: "nope", newPassword: "a brand new password" }, cookie, address),
        deps(),
        {
          userId,
          email,
        },
      );
    // Five from one address pass the limit (and are refused as wrong); the sixth is "too many tries".
    for (let i = 0; i < 5; i += 1) await wrongFrom("198.51.100.200");
    const sixth = problem((await wrongFrom("198.51.100.200")) as { data: ChangeFormData });
    expect(sixth.error).toBe(FORM_MESSAGES.rateLimited);

    // Other addresses each get their own five, but the account's ten guesses an hour are shared.
    for (let i = 0; i < SIGN_IN_FAILURE_LIMIT - 5; i += 1) await wrongFrom(`198.51.100.${String(201 + i)}`);
    const paused = problem(
      await changePassword(
        formEvent({ password: PASSWORD, newPassword: "a brand new password" }, cookie, "198.51.100.250"),
        deps(),
        { userId, email },
      ),
    );
    // Even the right password is refused while the account is paused.
    expect(paused.error).toBe(FORM_MESSAGES.tooManyWrong);
  });
});
