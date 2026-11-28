import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { cookiePolicy } from "../../../src/features/accounts/cookies.ts";
import {
  FORM_MESSAGES,
  finishReset,
  finishSignUp,
  requestReset,
  resendCode,
  SIGN_UP_COOKIE,
  signInWithPassword,
  signOut,
  startSignUp,
  type FormDeps,
  type FormEvent,
  type SignUpDeps,
} from "../../../src/features/accounts/forms.ts";
import { SIGN_IN_PAUSED_MESSAGE } from "../../../src/features/accounts/sign-in-pause-plugin.ts";
import { TestClock } from "../../support/test-clock.ts";

const ORIGIN = "http://localhost:5173";

interface FakeCookies {
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  get: (name: string) => string | undefined;
  parse: (header: string) => {
    name: string;
    value: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
  };
}

/** A form POST as SvelteKit hands it to an action, with a cookie jar that records `set`. */
function formEvent(
  fields: Record<string, string>,
  cookieHeader = "rk_session=old",
  jar: Record<string, string> = {},
): FormEvent & { cookies: FakeCookies } {
  const body = new URLSearchParams(fields);
  return {
    request: new Request(`${ORIGIN}/sign-in`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader,
        "user-agent": "test-browser",
      },
      body,
    }),
    getClientAddress: () => "198.51.100.7",
    cookies: {
      set: vi.fn(),
      delete: vi.fn(),
      get: (name: string) => jar[name],
      // Enough of cookie.parseSetCookie for these tests: the name, value, path and two flags. cspell:ignore httponly
      parse: (header: string) => {
        const [pair = "", ...attributes] = header.split(";");
        const [name = "", value = ""] = pair.split("=");
        const has = (flag: string) =>
          attributes.some((attribute: string) => attribute.trim().toLowerCase() === flag);
        const path = attributes
          .find((attribute: string) => attribute.trim().toLowerCase().startsWith("path="))
          ?.split("=")[1];
        const secure = has("secure") ? { secure: true } : {};
        const httpOnly = has("httponly") ? { httpOnly: true } : {};
        return path === undefined
          ? { name, value, ...secure, ...httpOnly }
          : { name, value, path, ...secure, ...httpOnly };
      },
    },
  } as unknown as FormEvent & { cookies: FakeCookies };
}

function reply(status: number, body: unknown = {}, setCookie: string[] = []): Response {
  const headers = new Headers({ "content-type": "application/json" });
  for (const line of setCookie) headers.append("set-cookie", line);
  return new Response(JSON.stringify(body), { status, headers });
}

function deps(
  handler: (request: Request) => Promise<Response>,
): FormDeps & { handler: ReturnType<typeof vi.fn> } {
  return { handler: vi.fn(handler), baseURL: ORIGIN, cookies: cookiePolicy(ORIGIN) };
}

/** Runs an action and returns where it redirected, or throws if it did not. */
async function redirectOf(action: Promise<unknown>): Promise<{ status: number; location: string }> {
  try {
    await action;
  } catch (thrown) {
    if (isRedirect(thrown)) return { status: thrown.status, location: thrown.location };
    throw thrown;
  }
  throw new Error("the action did not redirect");
}

const NUMBER = "+13125551234";
const US = { country: "US", phone: "312 555 1234" };

describe("signInWithPassword", () => {
  it("asks better-auth from the server with the visitor's cookies, address and our origin, the number as E.164", async () => {
    const formDeps = deps(() =>
      Promise.resolve(reply(200, {}, ["rk_session=token.sig; Path=/; HttpOnly; SameSite=Lax"])),
    );
    await redirectOf(
      signInWithPassword(formEvent({ ...US, password: "correct horse", next: "/me" }), formDeps),
    );

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/sign-in/phone-number`);
    expect(request.method).toBe("POST");
    expect(request.headers.get("origin")).toBe(ORIGIN);
    expect(request.headers.get("cookie")).toBe("rk_session=old");
    expect(request.headers.get("x-ruken-client-ip")).toBe("198.51.100.7");
    expect(await request.json()).toEqual({ phoneNumber: NUMBER, password: "correct horse" });
  });

  it.each([
    ["US", "(312) 555-1234"],
    ["US", "+1 312 555 1234"],
    ["US", "1-312-555-1234"],
    ["CA", "312.555.1234"],
  ])("reads %s %s as the same number", async (country, phone) => {
    const formDeps = deps(() => Promise.resolve(reply(200)));
    await redirectOf(signInWithPassword(formEvent({ country, phone, password: "correct horse" }), formDeps));
    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect((await request.json<{ phoneNumber: string }>()).phoneNumber).toBe(NUMBER);
  });

  it("copies the session cookie to the browser and goes on to next", async () => {
    const event = formEvent({ ...US, password: "correct horse", next: "/me" });
    const formDeps = deps(() =>
      Promise.resolve(reply(200, {}, ["rk_session=token.sig; Path=/; HttpOnly; SameSite=Lax"])),
    );

    expect(await redirectOf(signInWithPassword(event, formDeps))).toEqual({ status: 303, location: "/me" });
    expect(event.cookies.set).toHaveBeenCalledWith("rk_session", "token.sig", {
      path: "/",
      secure: false,
      httpOnly: true,
    });
  });

  it("copies better-auth's Secure flag as it is, so SvelteKit does not add one on plain-http localhost", async () => {
    const event = formEvent({ ...US, password: "correct horse" });
    const formDeps = deps(() =>
      Promise.resolve(reply(200, {}, ["__Host-rk_session=token.sig; Path=/; Secure", "other=1; Path=/"])),
    );
    await redirectOf(signInWithPassword(event, formDeps));
    expect(event.cookies.set).toHaveBeenCalledWith("__Host-rk_session", "token.sig", {
      path: "/",
      secure: true,
      httpOnly: false,
    });
    expect(event.cookies.set).toHaveBeenCalledWith("other", "1", {
      path: "/",
      secure: false,
      httpOnly: false,
    });
  });

  it("sends a person back to / when next points off the site", async () => {
    for (const next of ["https://evil.example", "//evil.example"]) {
      const event = formEvent({ ...US, password: "long enough pw", next });
      const result = signInWithPassword(
        event,
        deps(() => Promise.resolve(reply(200))),
      );
      await expect(result).rejects.toMatchObject({ status: 303, location: "/" });
    }
  });

  it("says quietly when the number and password don't match, keeping the country and number", async () => {
    const result = await signInWithPassword(
      formEvent({ ...US, password: "wrong horse" }),
      deps(() => Promise.resolve(reply(401))),
    );
    expect(result).toMatchObject({
      status: 400,
      data: { country: "US", phone: "312 555 1234", error: FORM_MESSAGES.wrongPassword },
    });
  });

  it("answers a number that cannot be one, or a closed country, as a wrong password, without calling better-auth", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200)));
    for (const fields of [
      { country: "US", phone: "abc", password: "x" },
      { country: "US", phone: "", password: "x" },
      { country: "GB", phone: "7700 900123", password: "x" },
      { country: "", phone: "312 555 1234", password: "x" },
    ]) {
      expect(await signInWithPassword(formEvent(fields), formDeps)).toMatchObject({
        status: 400,
        data: { error: FORM_MESSAGES.wrongPassword },
      });
    }
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("explains a rate limit", async () => {
    const result = await signInWithPassword(
      formEvent({ ...US, password: "wrong horse" }),
      deps(() => Promise.resolve(reply(429))),
    );
    expect(result).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });

  it("says password sign-in is paused, in the same words for any number, and points to the way back in", async () => {
    const paused = () => Promise.resolve(reply(429, { code: "SIGN_IN_PAUSED" }));
    const known = await signInWithPassword(formEvent({ ...US, password: "correct horse" }), deps(paused));
    const stranger = await signInWithPassword(
      formEvent({ country: "US", phone: "415 555 9999", password: "correct horse" }),
      deps(paused),
    );

    expect(known).toMatchObject({
      status: 429,
      data: { phone: "312 555 1234", error: FORM_MESSAGES.signInPaused },
    });
    expect(stranger).toMatchObject({
      status: 429,
      data: { phone: "415 555 9999", error: FORM_MESSAGES.signInPaused },
    });
    // One message, said once: the form shows the same words better-auth answered with.
    expect(FORM_MESSAGES.signInPaused).toBe(SIGN_IN_PAUSED_MESSAGE);
    expect(FORM_MESSAGES.signInPaused).toMatch(/reset your password/);
    expect(FORM_MESSAGES.signInPaused).not.toMatch(/account/i);
  });
});

describe("requestReset", () => {
  it("asks for a code for the number, as E.164, and goes to the second screen", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { status: true })));
    const result = await requestReset(formEvent(US), formDeps);

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/phone-number/request-password-reset`);
    expect(await request.json()).toEqual({ phoneNumber: NUMBER });
    expect(result).toEqual({ step: "code", number: NUMBER, country: "US", phone: "312 555 1234" });
  });

  it("answers the same second screen whatever the number", async () => {
    const answer = () => Promise.resolve(reply(200, { status: true }));
    const known = await requestReset(formEvent(US), deps(answer));
    const stranger = await requestReset(formEvent({ country: "US", phone: "415 555 9999" }), deps(answer));
    expect(known).toMatchObject({ step: "code" });
    expect(stranger).toMatchObject({ step: "code" });
  });

  it("checks the number before calling better-auth", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200)));
    expect(await requestReset(formEvent({ country: "US", phone: " " }), formDeps)).toMatchObject({
      status: 400,
      data: { error: FORM_MESSAGES.phoneInvalid },
    });
    expect(await requestReset(formEvent({ country: "GB", phone: "7700 900123" }), formDeps)).toMatchObject({
      status: 400,
      data: { closedCountry: true, error: FORM_MESSAGES.closedCountry },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "CODE_TOO_SOON" }, FORM_MESSAGES.codeTooSoon],
    [{ code: "CODES_PAUSED" }, FORM_MESSAGES.codesPaused],
    [{ code: "RATE_LIMITED" }, FORM_MESSAGES.rateLimited],
    [{}, FORM_MESSAGES.rateLimited],
  ])("explains a 429 with %j", async (body, message) => {
    const result = await requestReset(
      formEvent(US),
      deps(() => Promise.resolve(reply(429, body))),
    );
    expect(result).toMatchObject({
      status: 429,
      data: { error: message, country: "US", phone: "312 555 1234" },
    });
  });

  it("asks again from the code screen with the number it kept, and stays on that screen", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { status: true })));
    const result = await requestReset(formEvent({ ...US, number: NUMBER, step: "code" }), formDeps);
    expect(result).toMatchObject({ step: "code", number: NUMBER });
  });

  it("stays on the code screen when asking again is refused, and says why", async () => {
    const result = await requestReset(
      formEvent({ ...US, number: NUMBER, step: "code" }),
      deps(() => Promise.resolve(reply(429, { code: "CODE_TOO_SOON" }))),
    );
    expect(result).toMatchObject({
      status: 429,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codeTooSoon },
    });
  });
});

describe("finishReset", () => {
  const GOOD = {
    number: NUMBER,
    code: "123456",
    password: "a brand new horse",
    confirm: "a brand new horse",
  };

  function resetDeps(handler: (request: Request) => Promise<Response>) {
    return { ...deps(handler), codeUsed: vi.fn() };
  }

  it("sends the code and the new password to better-auth, tells Twilio the code was used, then goes to sign-in with a note", async () => {
    const formDeps = resetDeps(() => Promise.resolve(reply(200, { status: true })));

    expect(await redirectOf(finishReset(formEvent(GOOD), formDeps))).toEqual({
      status: 303,
      location: "/sign-in?reset=1",
    });

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/phone-number/reset-password`);
    expect(await request.json()).toEqual({
      phoneNumber: NUMBER,
      otp: "123456",
      newPassword: "a brand new horse",
    });
    expect(formDeps.codeUsed).toHaveBeenCalledWith(NUMBER);
  });

  it("checks length and the retyped password before calling better-auth, and keeps the number", async () => {
    const formDeps = resetDeps(() => Promise.resolve(reply(200)));

    const short = await finishReset(formEvent({ ...GOOD, password: "short", confirm: "short" }), formDeps);
    expect(short).toMatchObject({
      status: 400,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.passwordLength },
    });
    const differ = await finishReset(formEvent({ ...GOOD, confirm: "a brand new hors" }), formDeps);
    expect(differ).toMatchObject({
      status: 400,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.passwordsDiffer },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(formDeps.codeUsed).not.toHaveBeenCalled();
  });

  it("says the code isn't right for a wrong or used up one, keeping the number, and tells Twilio nothing", async () => {
    for (const status of [400, 403]) {
      const formDeps = resetDeps(() => Promise.resolve(reply(status, { code: "INVALID_OTP" })));
      expect(await finishReset(formEvent(GOOD), formDeps)).toMatchObject({
        status: 400,
        data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codeWrong },
      });
      expect(formDeps.codeUsed).not.toHaveBeenCalled();
    }
  });

  it("says codes are paused, and explains any other rate limit", async () => {
    expect(
      await finishReset(
        formEvent(GOOD),
        resetDeps(() => Promise.resolve(reply(429, { code: "CODES_PAUSED" }))),
      ),
    ).toMatchObject({ status: 429, data: { step: "code", error: FORM_MESSAGES.codesPaused } });
    expect(
      await finishReset(
        formEvent(GOOD),
        resetDeps(() => Promise.resolve(reply(429))),
      ),
    ).toMatchObject({
      status: 429,
      data: { error: FORM_MESSAGES.rateLimited },
    });
  });

  it("refuses a number that is not one, without calling better-auth", async () => {
    const formDeps = resetDeps(() => Promise.resolve(reply(200)));
    expect(await finishReset(formEvent({ ...GOOD, number: "312" }), formDeps)).toMatchObject({ status: 400 });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });
});

describe("startSignUp", () => {
  // It is Oct 14, 2026 in Chicago.
  const clock = new TestClock("2026-10-14T17:00:00Z");
  const adult = { month: "5", day: "3", year: "1990" };
  const valid = { ...US, password: "correct horse", ...adult, next: "/me" };
  const sent = () => reply(200, { message: "code sent" });

  /** The age 13 or older, as someone who turns `age` today. */
  function dateOfAge(age: number): { month: string; day: string; year: string } {
    return { month: "10", day: "14", year: String(2026 - age) };
  }

  function signUpDeps(handler: (request: Request) => Promise<Response> = () => Promise.resolve(sent())) {
    return {
      ...deps(handler),
      clock,
      hashPassword: vi.fn((password: string) => Promise.resolve(`hashed:${password}`)),
      keepPending: vi.fn(() => Promise.resolve()),
      takePending: vi.fn(() => Promise.resolve(null)),
      accountExists: vi.fn(() => Promise.resolve(false)),
      countCodeTry: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("wrong" as const)),
      countWrongCode: vi.fn(() => Promise.resolve()),
      codesPaused: vi.fn(() => Promise.resolve(false)),
      makeAccount: vi.fn(() => Promise.resolve()),
      removeHalfMadeAccount: vi.fn(() => Promise.resolve()),
      codeUsed: vi.fn(),
    } satisfies SignUpDeps;
  }

  it("keeps the hashed password and the 18th birthday for this browser, asks for a code, and shows the code screen", async () => {
    const event = formEvent(valid);
    const formDeps = signUpDeps();

    const result = await startSignUp(event, formDeps);

    expect(result).toMatchObject({
      step: "code",
      number: NUMBER,
      country: "US",
      phone: "312 555 1234",
      next: "/me",
    });
    expect(formDeps.hashPassword).toHaveBeenCalledWith("correct horse");
    const kept = formDeps.keepPending.mock.calls[0] as unknown as [
      { number: string; browser: string; passwordHash: string; adultOn: Date },
    ];
    expect(kept[0]).toMatchObject({ number: NUMBER, passwordHash: "hashed:correct horse" });
    expect(kept[0].browser).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(kept[0].adultOn).toEqual(new Date("2008-05-03T00:00:00Z"));
    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/phone-number/send-otp`);
    // better-auth never sees the password, or the date of birth.
    expect(await request.json()).toEqual({ phoneNumber: NUMBER });
  });

  it("keeps the browser's own value in a cookie a script cannot read, not on the whole site and not __Host-", async () => {
    const event = formEvent(valid);
    const formDeps = signUpDeps();
    await startSignUp(event, formDeps);

    const calls = event.cookies.set.mock.calls as [string, string, Record<string, unknown>][];
    const [name, value, options] = calls.find(([cookie]) => cookie === SIGN_UP_COOKIE) ?? [];
    expect(SIGN_UP_COOKIE).toBe("ruken_sign_up");
    expect(name).toBe("ruken_sign_up");
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(options).toMatchObject({
      path: "/sign-up",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 600,
      secure: false,
    });
    expect((formDeps.keepPending.mock.calls[0] as unknown as [{ browser: string }])[0].browser).toBe(value);
  });

  it("uses the browser's own value when it has one, and sets the cookie on https as Secure", async () => {
    const event = formEvent(valid, "rk_session=old", { [SIGN_UP_COOKIE]: "kept-value" });
    const formDeps = { ...signUpDeps(), cookies: cookiePolicy("https://ruken.example") };
    await startSignUp(event, formDeps);
    expect((formDeps.keepPending.mock.calls[0] as unknown as [{ browser: string }])[0].browser).toBe(
      "kept-value",
    );
    expect(event.cookies.set).toHaveBeenCalledWith(
      SIGN_UP_COOKIE,
      "kept-value",
      expect.objectContaining({ secure: true }),
    );
  });

  it("lets a 13 to 17 year old in the same way", async () => {
    const formDeps = signUpDeps();
    const result = await startSignUp(formEvent({ ...valid, ...dateOfAge(15) }), formDeps);
    expect(result).toMatchObject({ step: "code" });
    expect((formDeps.keepPending.mock.calls[0] as unknown as [{ adultOn: Date }])[0].adultOn).toEqual(
      new Date("2029-10-14T00:00:00Z"),
    );
  });

  it("refuses an under-13 date before any text, and keeps nothing", async () => {
    const formDeps = signUpDeps();
    const result = await startSignUp(formEvent({ ...valid, ...dateOfAge(12) }), formDeps);
    expect(result).toMatchObject({ status: 400, data: { tooYoung: true } });
    expect(result).toEqual(expect.objectContaining({ data: { tooYoung: true } }));
    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(formDeps.keepPending).not.toHaveBeenCalled();
    expect(formDeps.hashPassword).not.toHaveBeenCalled();
  });

  it("is refused for a closed country before anything is kept or sent", async () => {
    const formDeps = signUpDeps();
    const result = await startSignUp(formEvent({ ...valid, country: "GB", phone: "7700 900123" }), formDeps);
    expect(result).toMatchObject({
      status: 400,
      data: { closedCountry: true, error: FORM_MESSAGES.closedCountry },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(formDeps.keepPending).not.toHaveBeenCalled();
  });

  it("is refused for a number of another country typed with its +, before anything is kept or sent", async () => {
    const formDeps = signUpDeps();
    const result = await startSignUp(
      formEvent({ ...valid, country: "US", phone: "+44 7700 900123" }),
      formDeps,
    );
    expect(result).toMatchObject({
      status: 400,
      data: { closedCountry: true, error: FORM_MESSAGES.closedCountry },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(formDeps.keepPending).not.toHaveBeenCalled();
  });

  it("refuses a number of another country on forgot password too, and signs in as a wrong password", async () => {
    const formDeps = deps(() => Promise.resolve(sent()));
    expect(
      await requestReset(formEvent({ country: "US", phone: "+44 7700 900123" }), formDeps),
    ).toMatchObject({ status: 400, data: { closedCountry: true } });
    expect(
      await signInWithPassword(
        formEvent({ country: "US", phone: "+44 7700 900123", password: "correct horse" }),
        formDeps,
      ),
    ).toMatchObject({ status: 400, data: { error: FORM_MESSAGES.wrongPassword } });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("answers a code from a client past its tries the same, whether or not the number has an account", async () => {
    const answers: unknown[] = [];
    for (const hasAccount of [false, true]) {
      const formDeps = signUpDeps();
      formDeps.countCodeTry.mockResolvedValue(false);
      formDeps.accountExists.mockResolvedValue(hasAccount);
      answers.push(await finishSignUp(formEvent({ number: NUMBER, code: "123456" }), formDeps));
      expect(formDeps.consumeCode).not.toHaveBeenCalled();
      expect(formDeps.handler).not.toHaveBeenCalled();
    }
    expect(answers[0]).toEqual(answers[1]);
    expect(answers[0]).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });

  it.each([
    [{ ...valid, phone: "" }, FORM_MESSAGES.phoneInvalid],
    [{ ...valid, phone: "12345" }, FORM_MESSAGES.phoneInvalid],
    [{ ...valid, password: "a".repeat(9) }, FORM_MESSAGES.passwordLength],
    [{ ...valid, password: "a".repeat(129) }, FORM_MESSAGES.passwordLength],
    [{ ...valid, month: "2", day: "30" }, FORM_MESSAGES.birthDateInvalid],
    [{ ...valid, year: "" }, FORM_MESSAGES.birthDateInvalid],
    [{ ...valid, year: "2027" }, FORM_MESSAGES.birthDateInvalid],
  ])(
    "checks %j before calling better-auth, keeping what was typed but not the password",
    async (fields, message) => {
      const formDeps = signUpDeps();
      const result = await startSignUp(formEvent(fields), formDeps);
      expect(result).toMatchObject({
        status: 400,
        data: {
          error: message,
          country: fields.country,
          phone: fields.phone,
          month: fields.month,
          day: fields.day,
          year: fields.year,
        },
      });
      expect(JSON.stringify(result)).not.toContain(fields.password);
      expect(formDeps.handler).not.toHaveBeenCalled();
      expect(formDeps.keepPending).not.toHaveBeenCalled();
    },
  );

  it("shows the same code screen whether or not an account has the number: the form never asks", async () => {
    const formDeps = signUpDeps();
    await startSignUp(formEvent(valid), formDeps);
    expect(formDeps.accountExists).not.toHaveBeenCalled();
  });

  it.each([
    [{ code: "CODE_TOO_SOON" }, FORM_MESSAGES.codeTooSoon],
    [{ code: "CODES_PAUSED" }, FORM_MESSAGES.codesPaused],
    [{ code: "RATE_LIMITED" }, FORM_MESSAGES.rateLimited],
  ])("explains a 429 with %j, on the first screen with what was typed", async (body, message) => {
    const result = await startSignUp(
      formEvent(valid),
      signUpDeps(() => Promise.resolve(reply(429, body))),
    );
    expect(result).toMatchObject({
      status: 429,
      data: { error: message, country: "US", phone: "312 555 1234" },
    });
  });

  it("sends a person on to / when next points off the site: it is only carried to the end", async () => {
    const result = await startSignUp(formEvent({ ...valid, next: "https://evil.example" }), signUpDeps());
    expect(result).toMatchObject({ step: "code", next: "https://evil.example" });
  });
});

describe("finishSignUp", () => {
  const BASE = { number: NUMBER, code: "123456", next: "/me" };
  const verified = (setCookie: string[] = ["rk_session=token.sig; Path=/; HttpOnly"]) =>
    reply(200, { status: true, token: "t", user: { id: "user_1" } }, setCookie);
  const pending = { passwordHash: "hashed:correct horse", adultOn: new Date("2008-05-03T00:00:00Z") };

  function signUpDeps(
    handler: (request: Request) => Promise<Response> = () => Promise.resolve(verified()),
    over: Partial<Omit<SignUpDeps, "handler">> = {},
  ) {
    return {
      ...deps(handler),
      clock: new TestClock("2026-10-14T17:00:00Z"),
      hashPassword: vi.fn(() => Promise.resolve("hash")),
      keepPending: vi.fn(() => Promise.resolve()),
      takePending: vi.fn(() => Promise.resolve(pending)),
      accountExists: vi.fn(() => Promise.resolve(false)),
      countCodeTry: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("wrong" as const)),
      countWrongCode: vi.fn(() => Promise.resolve()),
      codesPaused: vi.fn(() => Promise.resolve(false)),
      makeAccount: vi.fn(() => Promise.resolve()),
      removeHalfMadeAccount: vi.fn(() => Promise.resolve()),
      codeUsed: vi.fn(),
      ...over,
    } satisfies SignUpDeps;
  }

  const jar = { [SIGN_UP_COOKIE]: "browser-value" };

  it("checks the code with better-auth, finishes the account from what this browser kept, and asks the name before next", async () => {
    const event = formEvent(BASE, "rk_session=old", jar);
    const formDeps = signUpDeps();

    expect(await redirectOf(finishSignUp(event, formDeps))).toEqual({
      status: 303,
      location: "/me/name?next=%2Fme",
    });

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/phone-number/verify`);
    expect(await request.json()).toEqual({ phoneNumber: NUMBER, code: "123456" });
    expect(formDeps.takePending).toHaveBeenCalledWith({ number: NUMBER, browser: "browser-value" });
    expect(formDeps.makeAccount).toHaveBeenCalledWith({
      userId: "user_1",
      number: NUMBER,
      passwordHash: "hashed:correct horse",
      adultOn: pending.adultOn,
    });
    expect(formDeps.codeUsed).toHaveBeenCalledWith(NUMBER);
    expect(formDeps.removeHalfMadeAccount).not.toHaveBeenCalled();
    expect(event.cookies.set).toHaveBeenCalledWith("rk_session", "token.sig", {
      path: "/",
      secure: false,
      httpOnly: true,
    });
    expect(event.cookies.delete).toHaveBeenCalledWith(SIGN_UP_COOKIE, { path: "/sign-up" });
  });

  it("never calls verify for a number that has an account: the code is checked and used up, and the screen says it is wrong", async () => {
    const formDeps = signUpDeps(() => Promise.resolve(verified()), {
      accountExists: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("ok" as const)),
    });
    const result = await finishSignUp(formEvent(BASE, "rk_session=old", jar), formDeps);

    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(formDeps.consumeCode).toHaveBeenCalledWith(NUMBER, "123456");
    expect(result).toMatchObject({
      status: 400,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codeWrong },
    });
    expect(formDeps.makeAccount).not.toHaveBeenCalled();
  });

  it("does the same for a browser that kept nothing for the number", async () => {
    const formDeps = signUpDeps(() => Promise.resolve(verified()), {
      takePending: vi.fn(() => Promise.resolve(null)),
      consumeCode: vi.fn(() => Promise.resolve("wrong" as const)),
    });
    const result = await finishSignUp(formEvent(BASE), formDeps);

    expect(formDeps.handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 400, data: { step: "code", error: FORM_MESSAGES.codeWrong } });
    expect(formDeps.takePending).toHaveBeenCalledWith({ number: NUMBER, browser: "" });
  });

  it("counts a wrong code on that path as better-auth's own check does, and says the same words", async () => {
    const wrong = signUpDeps(() => Promise.resolve(verified()), {
      accountExists: vi.fn(() => Promise.resolve(true)),
    });
    const right = signUpDeps(() => Promise.resolve(verified()), {
      accountExists: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("ok" as const)),
    });
    const noCode = signUpDeps(() => Promise.resolve(verified()), {
      accountExists: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("other" as const)),
    });
    const a = await finishSignUp(formEvent(BASE, "rk_session=old", jar), wrong);
    const b = await finishSignUp(formEvent(BASE, "rk_session=old", jar), right);
    const c = await finishSignUp(formEvent(BASE, "rk_session=old", jar), noCode);

    expect(wrong.countWrongCode).toHaveBeenCalledWith(NUMBER);
    expect(right.countWrongCode).not.toHaveBeenCalled();
    expect(noCode.countWrongCode).not.toHaveBeenCalled();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("refuses at once, without checking the code, once ten wrong ones are counted", async () => {
    const formDeps = signUpDeps(() => Promise.resolve(verified()), {
      accountExists: vi.fn(() => Promise.resolve(true)),
      codesPaused: vi.fn(() => Promise.resolve(true)),
    });
    const result = await finishSignUp(formEvent(BASE, "rk_session=old", jar), formDeps);
    expect(result).toMatchObject({
      status: 429,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codesPaused },
    });
    expect(formDeps.consumeCode).not.toHaveBeenCalled();
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("says the code isn't right for a wrong or used up one at verify, keeping the number, and tells Twilio nothing", async () => {
    for (const status of [400, 403]) {
      const formDeps = signUpDeps(() => Promise.resolve(reply(status, { code: "INVALID_OTP" })));
      const result = await finishSignUp(formEvent(BASE, "rk_session=old", jar), formDeps);
      expect(result).toMatchObject({
        status: 400,
        data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codeWrong },
      });
      expect(formDeps.codeUsed).not.toHaveBeenCalled();
      expect(formDeps.makeAccount).not.toHaveBeenCalled();
    }
  });

  it("explains a 429 at verify: paused codes, or any other limit", async () => {
    expect(
      await finishSignUp(
        formEvent(BASE, "rk_session=old", jar),
        signUpDeps(() => Promise.resolve(reply(429, { code: "CODES_PAUSED" }))),
      ),
    ).toMatchObject({ status: 429, data: { step: "code", error: FORM_MESSAGES.codesPaused } });
    expect(
      await finishSignUp(
        formEvent(BASE, "rk_session=old", jar),
        signUpDeps(() => Promise.resolve(reply(429))),
      ),
    ).toMatchObject({ status: 429, data: { step: "code", error: FORM_MESSAGES.rateLimited } });
  });

  it("leaves no account when the last step fails: removes it, clears the session, keeps what was kept, and offers to text again", async () => {
    const event = formEvent(BASE, "rk_session=old", jar);
    const formDeps = signUpDeps(() => Promise.resolve(verified()), {
      makeAccount: vi.fn(() => Promise.reject(new Error("the database hiccuped"))),
    });

    const result = await finishSignUp(event, formDeps);

    expect(formDeps.removeHalfMadeAccount).toHaveBeenCalledWith("user_1");
    expect(result).toMatchObject({
      status: 500,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.failed },
    });
    // The session cookie better-auth set is forgotten again, and the browser keeps its own value for the next try.
    expect(event.cookies.set).toHaveBeenLastCalledWith(
      "rk_session",
      "",
      expect.objectContaining({ path: "/", maxAge: 0 }),
    );
    expect(event.cookies.delete).not.toHaveBeenCalledWith(SIGN_UP_COOKIE, expect.anything());
    expect(formDeps.codeUsed).not.toHaveBeenCalled();
  });

  it("sends a person on to / after the name when next points off the site", async () => {
    const result = finishSignUp(
      formEvent({ ...BASE, next: "https://evil.example" }, "rk_session=old", jar),
      signUpDeps(),
    );
    await expect(result).rejects.toMatchObject({ status: 303, location: "/me/name?next=%2F" });
  });

  it("refuses a number that is not one", async () => {
    const formDeps = signUpDeps();
    expect(
      await finishSignUp(formEvent({ ...BASE, number: "312" }, "rk_session=old", jar), formDeps),
    ).toMatchObject({
      status: 400,
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });
});

describe("resendCode", () => {
  const pending = { passwordHash: "hashed", adultOn: new Date("2008-05-03T00:00:00Z") };
  const jar = { [SIGN_UP_COOKIE]: "browser-value" };

  function signUpDeps(
    handler: (request: Request) => Promise<Response>,
    took: typeof pending | null = pending,
  ) {
    return {
      ...deps(handler),
      clock: new TestClock("2026-10-14T17:00:00Z"),
      hashPassword: vi.fn(() => Promise.resolve("hash")),
      keepPending: vi.fn(() => Promise.resolve()),
      takePending: vi.fn(() => Promise.resolve(took)),
      accountExists: vi.fn(() => Promise.resolve(false)),
      countCodeTry: vi.fn(() => Promise.resolve(true)),
      consumeCode: vi.fn(() => Promise.resolve("wrong" as const)),
      countWrongCode: vi.fn(() => Promise.resolve()),
      codesPaused: vi.fn(() => Promise.resolve(false)),
      makeAccount: vi.fn(() => Promise.resolve()),
      removeHalfMadeAccount: vi.fn(() => Promise.resolve()),
      codeUsed: vi.fn(),
    } satisfies SignUpDeps;
  }
  const fields = { ...US, number: NUMBER, next: "/me" };

  it("asks for a new code, keeps the sign-up another ten minutes, and stays on the code screen", async () => {
    const formDeps = signUpDeps(() => Promise.resolve(reply(200, { message: "code sent" })));
    const result = await resendCode(formEvent(fields, "rk_session=old", jar), formDeps);

    expect(result).toMatchObject({ step: "code", number: NUMBER });
    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/phone-number/send-otp`);
    expect(await request.json()).toEqual({ phoneNumber: NUMBER });
    expect(formDeps.keepPending).toHaveBeenCalledWith({
      number: NUMBER,
      browser: "browser-value",
      ...pending,
    });
  });

  it("goes back to the first screen, asking to start again, when this browser kept nothing", async () => {
    const formDeps = signUpDeps(() => Promise.resolve(reply(200)), null);
    const result = await resendCode(formEvent(fields, "rk_session=old", jar), formDeps);
    expect(result).toMatchObject({
      status: 400,
      data: { error: FORM_MESSAGES.signUpExpired, country: "US", phone: "312 555 1234" },
    });
    expect(JSON.stringify(result)).not.toContain('"step"');
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("stays on the code screen and says why when the ask is refused", async () => {
    const result = await resendCode(
      formEvent(fields, "rk_session=old", jar),
      signUpDeps(() => Promise.resolve(reply(429, { code: "CODE_TOO_SOON" }))),
    );
    expect(result).toMatchObject({
      status: 429,
      data: { step: "code", number: NUMBER, error: FORM_MESSAGES.codeTooSoon },
    });
  });
});

describe("signOut", () => {
  it("ends the session and copies the cookie that forgets it", async () => {
    const event = formEvent({}, "rk_session=token.sig");
    const formDeps = deps(() =>
      Promise.resolve(reply(200, { success: true }, ["rk_session=; Max-Age=0; Path=/; HttpOnly"])),
    );

    expect(await redirectOf(signOut(event, formDeps))).toEqual({ status: 303, location: "/" });
    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/sign-out`);
    expect(request.headers.get("cookie")).toContain("rk_session=token.sig");
    expect(event.cookies.set).toHaveBeenCalledWith("rk_session", "", {
      path: "/",
      secure: false,
      httpOnly: true,
    });
  });

  it("goes back to the page the person was on when `next` is a path on this site", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { success: true })));
    expect(await redirectOf(signOut(formEvent({ next: "/me" }), formDeps))).toEqual({
      status: 303,
      location: "/me",
    });
  });

  it.each([
    ["another site", "https://evil.example/"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash path", "/\\evil.example"],
    ["a path with a control character", "/me/\nmore"],
    ["an empty value", ""],
  ])("goes home when `next` is %s, and still signs out", async (_name, next) => {
    const formDeps = deps(() => Promise.resolve(reply(200, { success: true })));
    expect(await redirectOf(signOut(formEvent({ next }), formDeps))).toEqual({ status: 303, location: "/" });
    expect(formDeps.handler).toHaveBeenCalledOnce();
  });
});
