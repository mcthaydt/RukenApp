import { describe, expect, it, vi, type Mock } from "vitest";
import type { SessionInfo } from "../../../src/features/accounts/auth.ts";
import type { Caller } from "../../../src/features/accounts/caller.ts";
import { cookiePolicy } from "../../../src/features/accounts/cookies.ts";
import { createHandle, type HandleDeps } from "../../../src/features/accounts/handle.ts";
import type { StaffRole } from "../../../src/lib/server/db.ts";

interface FakeEvent {
  request: Request;
  url: URL;
  route: { id: string | null };
  locals: { caller?: Caller };
  cookies: {
    get: Mock<(name: string) => string | undefined>;
    set: ReturnType<typeof vi.fn>;
    parse: ReturnType<typeof vi.fn>;
  };
}

/** `agreed: false` is a browser that has not said yes to cookies; every other test is one that has. */
function fakeEvent(
  path: string,
  init: { headers?: Record<string, string>; agreed?: boolean; routeId?: string | null } = {},
): FakeEvent {
  const url = new URL(path, "http://localhost:5173");
  const agreed = init.agreed ?? true;
  return {
    request: new Request(url, { headers: init.headers ?? {} }),
    url,
    route: { id: init.routeId ?? url.pathname },
    locals: {},
    cookies: {
      get: vi.fn((name: string) => (agreed && name === "rk_consent" ? "v1" : undefined)),
      set: vi.fn(),
      parse: vi.fn(parseCookieLine),
    },
  };
}

/** Enough of SvelteKit's `cookies.parse` for these tests: the name, the value and the attributes used here. */
function parseCookieLine(line: string): Record<string, unknown> {
  const [pair = "", ...attributes] = line.split("; ");
  const [name, value] = pair.split("=");
  const parsed: Record<string, unknown> = { name, value };
  for (const attribute of attributes) {
    const [key = "", setting] = attribute.split("=");
    if (key === "Max-Age") parsed.maxAge = Number(setting);
    if (key === "Path") parsed.path = setting;
    if (key === "HttpOnly") parsed.httpOnly = true;
    if (key === "SameSite") parsed.sameSite = setting?.toLowerCase();
  }
  return parsed;
}

function deps(overrides: Partial<HandleDeps> = {}): HandleDeps {
  return {
    cookies: cookiePolicy("http://localhost:5173"),
    getSession: vi.fn(() => Promise.resolve(null)),
    staffRolesOf: vi.fn(() => Promise.resolve([] as StaffRole[])),
    computerKey: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
}

async function run(event: FakeEvent, handleDeps: HandleDeps): Promise<Caller | undefined> {
  const handle = createHandle(() => handleDeps);
  const resolve = vi.fn(() => Promise.resolve(new Response("ok")));
  // The fake carries only the parts of a RequestEvent the hook reads.
  await handle({ event: event as never, resolve });
  expect(resolve).toHaveBeenCalledOnce();
  return event.locals.caller;
}

const session: SessionInfo = { sessionId: "session_1", userId: "user_1", userStatus: "active" };

describe("createHandle: signed-in sessions", () => {
  it("resolves a session to a user with their staff roles", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    const staffRolesOf = vi.fn(() => Promise.resolve(["owner"] as StaffRole[]));
    const event = fakeEvent("/", { headers: { cookie: "rk_session=abc" } });

    expect(await run(event, deps({ getSession, staffRolesOf }))).toEqual({
      kind: "user",
      userId: "user_1",
      sessionId: "session_1",
      staffRoles: ["owner"],
    });
    expect(getSession).toHaveBeenCalledWith(event.request.headers);
    expect(staffRolesOf).toHaveBeenCalledWith("user_1");
    expect(event.cookies.set).not.toHaveBeenCalled();
  });

  it("does not read the sign-in cookie until this browser has said yes to cookies", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    const event = fakeEvent("/", { headers: { cookie: "rk_session=abc" }, agreed: false });

    expect(await run(event, deps({ getSession }))).toEqual({ kind: "none" });
    expect(getSession).not.toHaveBeenCalled();
    expect(event.cookies.set).not.toHaveBeenCalled();
  });

  it("still reads the session on a route only servers call, with no cookie of consent", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    const event = fakeEvent("/jobs/review", { agreed: false });

    expect(await run(event, deps({ getSession }))).toMatchObject({ kind: "user" });
  });

  it("is nobody when there is no session", async () => {
    const event = fakeEvent("/");
    expect(await run(event, deps())).toEqual({ kind: "none" });
    expect(event.cookies.set).not.toHaveBeenCalled();
  });

  it("copies the refreshed session cookie onto the response exactly, so the 30 days roll", async () => {
    const setCookies = ["rk_session=new; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax"];
    const event = fakeEvent("/", { headers: { cookie: "rk_session=abc" } });

    await run(event, deps({ getSession: () => Promise.resolve({ ...session, setCookies }) }));

    expect(event.cookies.set).toHaveBeenCalledWith("rk_session", "new", {
      path: "/",
      maxAge: 2592000,
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("leaves the session cookie to better-auth on its own /api/auth routes, so a refresh cannot undo a sign-out or a new sign-in", async () => {
    // SvelteKit appends the hook's cookies after the route's own Set-Cookie lines, so the browser
    // would keep this refreshed cookie over the one the sign-out or sign-in just sent.
    const setCookies = ["rk_session=old; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax"];
    const event = fakeEvent("/api/auth/sign-out", { headers: { cookie: "rk_session=old" } });

    await run(event, deps({ getSession: () => Promise.resolve({ ...session, setCookies }) }));

    expect(event.locals.caller).toMatchObject({ kind: "user" });
    expect(event.cookies.set).not.toHaveBeenCalled();
  });

  // The old session cookie of an account that is waiting to be deleted, or deleted, is treated as
  // signed out at once: it must not keep a person signed in.
  it.each(["pending_deletion", "deleted"])(
    "treats a session whose account is %s as signed out",
    async (userStatus) => {
      const event = fakeEvent("/", { headers: { cookie: "rk_session=abc" } });
      const staffRolesOf = vi.fn(() => Promise.resolve([] as StaffRole[]));

      expect(
        await run(
          event,
          deps({ getSession: () => Promise.resolve({ ...session, userStatus }), staffRolesOf }),
        ),
      ).toEqual({
        kind: "none",
      });
      expect(staffRolesOf).not.toHaveBeenCalled();
    },
  );
});

describe("createHandle: the health probe", () => {
  it("leaves /healthz alone: no sign-in settings needed, no database, no cookie, caller none", async () => {
    const getServices = vi.fn(() => deps());
    const handle = createHandle(getServices);
    const event = fakeEvent("/healthz");
    await handle({ event: event as never, resolve: () => Promise.resolve(new Response("ok")) });

    expect(event.locals.caller).toEqual({ kind: "none" });
    expect(getServices).not.toHaveBeenCalled();
    expect(event.cookies.set).not.toHaveBeenCalled();
  });

  it("does not skip a path that only starts like it", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    await run(fakeEvent("/healthz/more"), deps({ getSession }));
    expect(getSession).toHaveBeenCalledOnce();
  });
});

describe("createHandle: a computer's key", () => {
  const key = { userId: "user_1", keyId: "key_1" };
  const header = { authorization: "Bearer rk_whatever" };

  it("is a computer under /api/v1, and the session cookie is not read there", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    const computerKey = vi.fn(() => Promise.resolve(key));
    const event = fakeEvent("/api/v1/games", { headers: { ...header, cookie: "rk_session=abc" } });

    expect(await run(event, deps({ getSession, computerKey }))).toEqual({ kind: "computer", ...key });
    expect(computerKey).toHaveBeenCalledWith("Bearer rk_whatever");
    expect(getSession).not.toHaveBeenCalled();
  });

  it("is nobody under /api/v1 with a session cookie and no working key", async () => {
    const getSession = vi.fn(() => Promise.resolve(session));
    const event = fakeEvent("/api/v1/games", { headers: { cookie: "rk_session=abc" } });
    expect(await run(event, deps({ getSession }))).toEqual({ kind: "none" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("is never read anywhere else: the header is ignored and the session decides", async () => {
    const computerKey = vi.fn(() => Promise.resolve(key));
    for (const path of ["/me", "/me/password", "/make", "/jobs/money", "/webhooks/stripe", "/join"]) {
      expect(await run(fakeEvent(path, { headers: header }), deps({ computerKey }))).toEqual({
        kind: "none",
      });
    }
    expect(computerKey).not.toHaveBeenCalled();
  });

  it("is a different kind of caller than a person, so no screen's sign-in check lets it in", async () => {
    const event = fakeEvent("/api/v1/me", { headers: header });
    const caller = await run(event, deps({ computerKey: () => Promise.resolve(key) }));
    expect(caller?.kind).not.toBe("user");
  });
});
