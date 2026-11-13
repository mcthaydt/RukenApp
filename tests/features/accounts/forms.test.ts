import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it, vi } from "vitest";
import { cookiePolicy } from "../../../src/features/accounts/cookies.ts";
import {
  FORM_MESSAGES,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  type FormDeps,
  type FormEvent,
  type SignUpDeps,
} from "../../../src/features/accounts/forms.ts";
import { SIGN_IN_PAUSED_MESSAGE } from "../../../src/features/accounts/sign-in-pause-plugin.ts";
import { TestClock } from "../../support/test-clock.ts";

const ORIGIN = "http://localhost:5173";

interface FakeCookies {
  set: ReturnType<typeof vi.fn>;
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
      get: () => undefined,
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

describe("signInWithPassword", () => {
  it("asks better-auth from the server with the visitor's cookies, address and our origin", async () => {
    const formDeps = deps(() =>
      Promise.resolve(reply(200, {}, ["rk_session=token.sig; Path=/; HttpOnly; SameSite=Lax"])),
    );
    await redirectOf(
      signInWithPassword(
        formEvent({ email: "pat@example.test", password: "correct horse", next: "/me" }),
        formDeps,
      ),
    );

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/sign-in/email`);
    expect(request.method).toBe("POST");
    expect(request.headers.get("origin")).toBe(ORIGIN);
    expect(request.headers.get("cookie")).toBe("rk_session=old");
    expect(request.headers.get("x-ruken-client-ip")).toBe("198.51.100.7");
    expect(await request.json()).toEqual({ email: "pat@example.test", password: "correct horse" });
  });

  it("copies the session cookie to the browser and goes on to next", async () => {
    const event = formEvent({ email: "pat@example.test", password: "correct horse", next: "/me" });
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
    const event = formEvent({ email: "pat@example.test", password: "correct horse" });
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
      const event = formEvent({ email: "a@b.test", password: "long enough pw", next });
      const result = signInWithPassword(
        event,
        deps(() => Promise.resolve(reply(200))),
      );
      await expect(result).rejects.toMatchObject({ status: 303, location: "/" });
    }
  });

  it("says quietly when the email and password don't match, keeping the email", async () => {
    const result = await signInWithPassword(
      formEvent({ email: "pat@example.test", password: "wrong horse" }),
      deps(() => Promise.resolve(reply(401))),
    );
    expect(result).toMatchObject({
      status: 400,
      data: { email: "pat@example.test", error: FORM_MESSAGES.wrongPassword },
    });
  });

  it("explains a rate limit", async () => {
    const result = await signInWithPassword(
      formEvent({ email: "pat@example.test", password: "wrong horse" }),
      deps(() => Promise.resolve(reply(429))),
    );
    expect(result).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });

  it("says password sign-in is paused, in the same words for any address, and points to the way back in", async () => {
    const paused = () => Promise.resolve(reply(429, { code: "SIGN_IN_PAUSED" }));
    const known = await signInWithPassword(
      formEvent({ email: "pat@example.test", password: "correct horse" }),
      deps(paused),
    );
    const stranger = await signInWithPassword(
      formEvent({ email: "nobody@example.test", password: "correct horse" }),
      deps(paused),
    );

    expect(known).toMatchObject({
      status: 429,
      data: { email: "pat@example.test", error: FORM_MESSAGES.signInPaused },
    });
    expect(stranger).toMatchObject({
      status: 429,
      data: { email: "nobody@example.test", error: FORM_MESSAGES.signInPaused },
    });
    // One message, said once: the form shows the same words better-auth answered with.
    expect(FORM_MESSAGES.signInPaused).toBe(SIGN_IN_PAUSED_MESSAGE);
    expect(FORM_MESSAGES.signInPaused).toMatch(/reset your password/);
    expect(FORM_MESSAGES.signInPaused).not.toMatch(/sign-in link/);
    expect(FORM_MESSAGES.signInPaused).not.toMatch(/account/i);
  });

  it("asks for an email before calling better-auth", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200)));
    const result = await signInWithPassword(formEvent({ email: " ", password: "correct horse" }), formDeps);
    expect(result).toMatchObject({ status: 400, data: { error: FORM_MESSAGES.emailMissing } });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset (N7)", () => {
  it("asks BetterAuth for a reset link that comes back to /reset-password", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { status: true })));
    await requestPasswordReset(formEvent({ email: "pat@example.test" }), formDeps);

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/request-password-reset`);
    expect(await request.json()).toEqual({ email: "pat@example.test", redirectTo: "/reset-password" });
  });

  it("answers sent, with the address, whether or not BetterAuth knew it", async () => {
    const result = await requestPasswordReset(
      formEvent({ email: "pat@example.test" }),
      deps(() => Promise.resolve(reply(200, { status: true }))),
    );
    expect(result).toEqual({ sent: true, email: "pat@example.test" });
  });

  it("asks for an email before calling BetterAuth", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200)));
    const result = await requestPasswordReset(formEvent({ email: " " }), formDeps);
    expect(result).toMatchObject({ status: 400, data: { error: FORM_MESSAGES.emailMissing } });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("explains a rate limit", async () => {
    const result = await requestPasswordReset(
      formEvent({ email: "pat@example.test" }),
      deps(() => Promise.resolve(reply(429))),
    );
    expect(result).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });
});

describe("resetPassword (N7)", () => {
  const GOOD = { token: "reset-token", password: "a brand new horse", confirm: "a brand new horse" };

  it("sends the token and the new password to BetterAuth, then goes to sign-in with a note", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { status: true })));

    expect(await redirectOf(resetPassword(formEvent(GOOD), formDeps))).toEqual({
      status: 303,
      location: "/sign-in?reset=1",
    });

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/reset-password`);
    expect(await request.json()).toEqual({ token: "reset-token", newPassword: "a brand new horse" });
  });

  it("checks length and the retyped password before calling BetterAuth, and keeps the token", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200)));

    const short = await resetPassword(formEvent({ ...GOOD, password: "short", confirm: "short" }), formDeps);
    expect(short).toMatchObject({
      status: 400,
      data: { token: "reset-token", error: FORM_MESSAGES.passwordLength },
    });
    const differ = await resetPassword(formEvent({ ...GOOD, confirm: "a brand new hors" }), formDeps);
    expect(differ).toMatchObject({
      status: 400,
      data: { token: "reset-token", error: FORM_MESSAGES.passwordsDiffer },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("says the link is no good when there is no token, or BetterAuth refuses it", async () => {
    const none = await resetPassword(
      formEvent({ ...GOOD, token: "" }),
      deps(() => Promise.resolve(reply(200))),
    );
    expect(none).toMatchObject({ status: 400, data: { linkInvalid: true } });
    const refused = await resetPassword(
      formEvent(GOOD),
      deps(() => Promise.resolve(reply(400, { code: "INVALID_TOKEN" }))),
    );
    expect(refused).toMatchObject({ status: 400, data: { linkInvalid: true } });
  });

  it("explains a rate limit", async () => {
    const result = await resetPassword(
      formEvent(GOOD),
      deps(() => Promise.resolve(reply(429))),
    );
    expect(result).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });
});

describe("resendVerification (M4)", () => {
  it("asks BetterAuth to mail the signed-in account's own address a fresh link that returns to /me", async () => {
    const formDeps = deps(() => Promise.resolve(reply(200, { status: true })));
    expect(await resendVerification(formEvent({}), formDeps, "pat@example.test")).toEqual({ resent: true });

    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/send-verification-email`);
    expect(await request.json()).toEqual({ email: "pat@example.test", callbackURL: "/me" });
  });

  it("explains a rate limit", async () => {
    const result = await resendVerification(
      formEvent({}),
      deps(() => Promise.resolve(reply(429))),
      "pat@example.test",
    );
    expect(result).toMatchObject({ status: 429, data: { error: FORM_MESSAGES.rateLimited } });
  });
});

describe("signUpWithPassword", () => {
  // It is Oct 14, 2026 in Chicago.
  const clock = new TestClock("2026-10-14T17:00:00Z");
  const adult = { month: "5", day: "3", year: "1990" };
  const valid = { email: "pat@example.test", password: "correct horse", ...adult, next: "/me" };
  const created = (setCookie: string[] = ["rk_session=token.sig; Path=/; HttpOnly"]) =>
    reply(200, { token: "t", user: { id: "user_1" } }, setCookie);

  /** The month, day and year of someone who turns `age` today. */
  function dateOfAge(age: number): { month: string; day: string; year: string } {
    return { month: "10", day: "14", year: String(2026 - age) };
  }

  function signUpDeps(handler: (request: Request) => Promise<Response> = () => Promise.resolve(created())) {
    const setBirthDate = vi.fn(() => Promise.resolve({ minor: false }));
    return { ...deps(handler), clock, setBirthDate } satisfies SignUpDeps;
  }

  it("creates the account, then stores the age, and goes on to next", async () => {
    const event = formEvent(valid);
    const formDeps = signUpDeps();

    expect(await redirectOf(signUpWithPassword(event, formDeps))).toEqual({ status: 303, location: "/me" });
    const request = formDeps.handler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe(`${ORIGIN}/api/auth/sign-up/email`);
    // better-auth never sees the date of birth, and there is no name to ask for.
    expect(await request.json()).toEqual({
      name: "Player",
      email: "pat@example.test",
      password: "correct horse",
    });
    expect(event.cookies.set).toHaveBeenCalledWith("rk_session", "token.sig", {
      path: "/",
      secure: false,
      httpOnly: true,
    });
    expect(formDeps.setBirthDate).toHaveBeenCalledWith("user_1", { year: 1990, month: 5, day: 3 });
  });

  it("lets a 13 to 17 year old in the same way", async () => {
    const formDeps = signUpDeps();
    expect(await redirectOf(signUpWithPassword(formEvent({ ...valid, ...dateOfAge(15) }), formDeps))).toEqual(
      { status: 303, location: "/me" },
    );
    expect(formDeps.setBirthDate).toHaveBeenCalledOnce();
  });

  it("refuses an under-13 date before any account is made", async () => {
    const handler = vi.fn();
    const formDeps = { ...signUpDeps(), handler };
    const result = await signUpWithPassword(formEvent({ ...valid, ...dateOfAge(12) }), formDeps);
    expect(result).toMatchObject({ status: 400, data: { tooYoung: true } });
    expect(handler).not.toHaveBeenCalled();
    expect(formDeps.setBirthDate).not.toHaveBeenCalled();
  });

  it("keeps nothing it was told when it refuses an under-13 date", async () => {
    const result = await signUpWithPassword(formEvent({ ...valid, ...dateOfAge(12) }), signUpDeps());
    expect(result).toEqual(expect.objectContaining({ data: { tooYoung: true } }));
  });

  it.each([
    [{ ...valid, email: "" }, FORM_MESSAGES.emailMissing],
    [{ ...valid, password: "a".repeat(9) }, FORM_MESSAGES.passwordLength],
    [{ ...valid, password: "a".repeat(129) }, FORM_MESSAGES.passwordLength],
    [{ ...valid, month: "2", day: "30" }, FORM_MESSAGES.birthDateInvalid],
    [{ ...valid, year: "" }, FORM_MESSAGES.birthDateInvalid],
    [{ ...valid, year: "2027" }, FORM_MESSAGES.birthDateInvalid],
  ])("checks %j before calling better-auth, keeping what was typed", async (fields, message) => {
    const formDeps = signUpDeps();
    const result = await signUpWithPassword(formEvent(fields), formDeps);
    expect(result).toMatchObject({
      status: 400,
      data: { error: message, email: fields.email, month: fields.month, day: fields.day, year: fields.year },
    });
    expect(formDeps.handler).not.toHaveBeenCalled();
  });

  it("sends a person to / when next points off the site", async () => {
    const result = signUpWithPassword(formEvent({ ...valid, next: "https://evil.example" }), signUpDeps());
    await expect(result).rejects.toMatchObject({ status: 303, location: "/" });
  });

  it("says when the email already has an account, and stores no age", async () => {
    const formDeps = signUpDeps(() =>
      Promise.resolve(reply(422, { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })),
    );
    const result = await signUpWithPassword(formEvent(valid), formDeps);
    expect(result).toMatchObject({ status: 400, data: { error: FORM_MESSAGES.accountExists } });
    expect(formDeps.setBirthDate).not.toHaveBeenCalled();
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
