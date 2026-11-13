import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../../src/lib/server/db.ts";
import type { Mailer, MailMessage } from "../../../src/lib/server/mail.ts";
import type { SignInGuards } from "../../../src/features/accounts/sign-in-guards.ts";

// The sign-in pause plugin: how the two hooks on /sign-in/email behave. The counting rules live in
// sign-in-guards.ts (tested against Postgres in sign-in-guards.pg.test.ts), so here those four
// functions are replaced with spies, and the tests check which one the plugin calls for each kind of
// request and answer, and that the owner of the account hears about a pause that starts.

const guardCalls = vi.hoisted(() => ({
  reserveSignInAttempt: vi.fn<(guards: unknown, email: string) => Promise<{ allowed: boolean }>>(),
  recordWrongPassword: vi.fn<(guards: unknown, email: string) => Promise<{ pauseStarted: boolean }>>(),
  releaseSignInAttempt: vi.fn<(guards: unknown, email: string) => Promise<void>>(),
  clearSignInFailures: vi.fn<(guards: unknown, email: string) => Promise<void>>(),
}));

vi.mock("../../../src/features/accounts/sign-in-guards.ts", () => guardCalls);

const { SIGN_IN_PAUSED, SIGN_IN_PAUSED_MESSAGE, signInPausePlugin } =
  await import("../../../src/features/accounts/sign-in-pause-plugin.ts");

const guards = { secret: "test-secret-that-is-long-enough" } as unknown as SignInGuards;
const SIGN_IN_PATH = "/sign-in/email";
const EMAIL = "Pat@Example.test";

const OWNER = "pat@example.test";

/** Everything the plugin is given besides the guards, with a mail box we can read and tasks we can wait for. */
function setup(options: { accountEmail?: string | null; sendMail?: Mailer["send"] } = {}) {
  const sent: MailMessage[] = [];
  const logged: string[] = [];
  const tasks: Promise<void>[] = [];
  const accountEmail = options.accountEmail === undefined ? OWNER : options.accountEmail;
  const prisma = {
    user: { findUnique: () => Promise.resolve(accountEmail === null ? null : { email: accountEmail }) },
  } as unknown as PrismaClient;
  const mailer: Mailer = {
    send:
      options.sendMail ??
      ((message) => {
        sent.push(message);
        return Promise.resolve(true);
      }),
  };
  const plugin = signInPausePlugin({
    guards,
    prisma,
    mailer,
    log: (line) => logged.push(line),
    runInBackground: (task) => {
      tasks.push(task());
    },
  });
  const before = plugin.hooks?.before?.[0];
  const after = plugin.hooks?.after?.[0];
  if (before === undefined || after === undefined) throw new Error("the plugin has no before or after hook");
  return { plugin, before, after, sent, logged, finishBackgroundWork: () => Promise.all(tasks) };
}

/** The plugin's hooks, as better-auth would call them: a matcher and a handler. */
function hooksOf() {
  return setup();
}

/** Calls a hook's handler directly with only the parts of the context the plugin reads. */
function callBefore(hook: ReturnType<typeof hooksOf>["before"], body: unknown): Promise<unknown> {
  return hook.handler({ path: SIGN_IN_PATH, body, headers: new Headers(), context: {} } as never);
}

function callAfter(
  hook: ReturnType<typeof hooksOf>["after"],
  body: unknown,
  returned: unknown,
): Promise<unknown> {
  return hook.handler({ path: SIGN_IN_PATH, body, headers: new Headers(), context: { returned } } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  guardCalls.reserveSignInAttempt.mockResolvedValue({ allowed: true });
  guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: false });
  guardCalls.releaseSignInAttempt.mockResolvedValue(undefined);
  guardCalls.clearSignInFailures.mockResolvedValue(undefined);
});

describe("the plugin", () => {
  it("is named sign-in-pause and has one hook before and one after", () => {
    const { plugin } = hooksOf();
    expect(plugin.id).toBe("sign-in-pause");
    expect(plugin.hooks?.before).toHaveLength(1);
    expect(plugin.hooks?.after).toHaveLength(1);
  });

  it("uses the error code SIGN_IN_PAUSED, with words that point to the reset", () => {
    expect(SIGN_IN_PAUSED).toBe("SIGN_IN_PAUSED");
    expect(SIGN_IN_PAUSED_MESSAGE).toBe(
      "Too many tries. Sign-in is paused for an hour for this email. You can reset your password now.",
    );
  });

  it("matches only the password sign-in path, in both hooks", () => {
    const { before, after } = hooksOf();
    for (const hook of [before, after]) {
      expect(hook.matcher({ path: "/sign-in/email" } as never)).toBe(true);
      expect(hook.matcher({ path: "/sign-in/magic-link" } as never)).toBe(false);
      expect(hook.matcher({ path: "/request-password-reset" } as never)).toBe(false);
      expect(hook.matcher({ path: "/sign-in/email/" } as never)).toBe(false);
      expect(hook.matcher({ path: undefined } as never)).toBe(false);
    }
  });
});

describe("the before hook", () => {
  it("reserves a guess for the address typed in, exactly as typed, and lets the request go on when allowed", async () => {
    const { before } = hooksOf();
    await expect(callBefore(before, { email: EMAIL, password: "x" })).resolves.toBeUndefined();
    expect(guardCalls.reserveSignInAttempt).toHaveBeenCalledTimes(1);
    expect(guardCalls.reserveSignInAttempt).toHaveBeenCalledWith(guards, EMAIL);
  });

  it("refuses with 429 and the paused words when the address is paused or out of guesses", async () => {
    guardCalls.reserveSignInAttempt.mockResolvedValue({ allowed: false });
    const { before } = hooksOf();

    const error: unknown = await callBefore(before, { email: EMAIL, password: "right-one" }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(APIError);
    const refused = error as APIError;
    expect(refused.statusCode).toBe(429);
    expect(refused.body?.code).toBe("SIGN_IN_PAUSED");
    expect(refused.body?.message).toBe(SIGN_IN_PAUSED_MESSAGE);
  });

  it.each([
    ["no body", undefined],
    ["an empty body", {}],
    ["an empty address", { email: "" }],
    ["an address of only spaces", { email: "   " }],
    ["an address that is not text", { email: 42 }],
    ["an address that is null", { email: null }],
  ])("leaves %s for the endpoint's own checks and counts nothing", async (_name, body) => {
    const { before } = hooksOf();
    await expect(callBefore(before, body)).resolves.toBeUndefined();
    expect(guardCalls.reserveSignInAttempt).not.toHaveBeenCalled();
  });

  it("does not trim the address it passes on (the guards lower-case and trim it when they hash it)", async () => {
    const { before } = hooksOf();
    await callBefore(before, { email: "  pat@example.test " });
    expect(guardCalls.reserveSignInAttempt).toHaveBeenCalledWith(guards, "  pat@example.test ");
  });

  it("lets an error from the guards through, so a broken table does not quietly allow guesses", async () => {
    guardCalls.reserveSignInAttempt.mockRejectedValue(new Error("database is down"));
    const { before } = hooksOf();
    await expect(callBefore(before, { email: EMAIL })).rejects.toThrow("database is down");
  });
});

describe("the after hook, when the password was right", () => {
  it("forgives the address: clears its guesses, and records nothing", async () => {
    const { after } = hooksOf();
    await callAfter(after, { email: EMAIL }, { token: "t", user: { id: "u1" } });
    expect(guardCalls.clearSignInFailures).toHaveBeenCalledTimes(1);
    expect(guardCalls.clearSignInFailures).toHaveBeenCalledWith(guards, EMAIL);
    expect(guardCalls.recordWrongPassword).not.toHaveBeenCalled();
    expect(guardCalls.releaseSignInAttempt).not.toHaveBeenCalled();
  });
});

describe("the after hook, when BetterAuth answered 401", () => {
  const wrongPassword = () => new APIError("UNAUTHORIZED", { message: "Invalid email or password" });

  it("counts it as a wrong password, and does not give the guess back", async () => {
    const { after } = hooksOf();
    await callAfter(after, { email: EMAIL }, wrongPassword());
    expect(guardCalls.recordWrongPassword).toHaveBeenCalledTimes(1);
    expect(guardCalls.recordWrongPassword).toHaveBeenCalledWith(guards, EMAIL);
    expect(guardCalls.releaseSignInAttempt).not.toHaveBeenCalled();
    expect(guardCalls.clearSignInFailures).not.toHaveBeenCalled();
  });

  it("mails the account's own address once, when that wrong password starts the pause", async () => {
    guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: true });
    const { after, sent, finishBackgroundWork } = setup();

    await callAfter(after, { email: EMAIL }, wrongPassword());
    await finishBackgroundWork();

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(OWNER);
    expect(sent[0]?.subject).toBe("Password sign-in on your Ruken account is paused");
  });

  it("sends nothing when the pause did not start (earlier wrong guesses, or already paused)", async () => {
    guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: false });
    const { after, sent, finishBackgroundWork } = setup();

    await callAfter(after, { email: EMAIL }, wrongPassword());
    await finishBackgroundWork();

    expect(sent).toEqual([]);
  });

  it("sends nothing for an address with no account, so a pause says nothing about who has one", async () => {
    guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: true });
    const { after, sent, finishBackgroundWork } = setup({ accountEmail: null });

    await callAfter(after, { email: EMAIL }, wrongPassword());
    await finishBackgroundWork();

    expect(sent).toEqual([]);
  });

  it("does not wait for the mail, so the answer does not depend on what the mail server does", async () => {
    guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: true });
    // A mail server that never answers. If the hook waited for it, the hook would never finish, so
    // the hook is raced against a short timer.
    const { after } = setup({ sendMail: () => new Promise<boolean>(() => undefined) });

    const outcome = await Promise.race([
      callAfter(after, { email: EMAIL }, wrongPassword()).then(() => "done"),
      new Promise<string>((resolve) => setTimeout(resolve, 20, "stuck")),
    ]);

    expect(outcome).toBe("done");
  });

  it("logs a failed notice by its error code, never with the address", async () => {
    guardCalls.recordWrongPassword.mockResolvedValue({ pauseStarted: true });
    const rejected = Object.assign(new Error("550 5.1.1 <pat@example.test>: Recipient address rejected"), {
      code: "EENVELOPE",
      responseCode: 550,
    });
    const { after, logged, finishBackgroundWork } = setup({ sendMail: () => Promise.reject(rejected) });

    await callAfter(after, { email: EMAIL }, wrongPassword());
    await finishBackgroundWork();

    expect(logged).toEqual(["sign-in pause notice not sent: EENVELOPE 550"]);
  });
});

describe("the after hook, when BetterAuth answered with any other error", () => {
  it.each([
    ["BAD_REQUEST", 400],
    ["FORBIDDEN", 403],
    ["TOO_MANY_REQUESTS", 429],
    ["INTERNAL_SERVER_ERROR", 500],
  ] as const)(
    "gives the guess back for a %s (%i), because it was not a wrong password",
    async (status, code) => {
      const { after, sent, finishBackgroundWork } = setup();

      const answer = new APIError(status, { message: "nope" });
      expect(answer.statusCode).toBe(code); // the status number the case name says, so the case is what it claims
      await callAfter(after, { email: EMAIL }, answer);

      expect(guardCalls.releaseSignInAttempt).toHaveBeenCalledTimes(1);
      expect(guardCalls.releaseSignInAttempt).toHaveBeenCalledWith(guards, EMAIL);
      expect(guardCalls.recordWrongPassword).not.toHaveBeenCalled();
      expect(guardCalls.clearSignInFailures).not.toHaveBeenCalled();
      await finishBackgroundWork();
      expect(sent).toEqual([]);
    },
  );
});

describe("the after hook, when there is nothing to settle", () => {
  it("does nothing when the request had no address", async () => {
    const { after } = hooksOf();
    await callAfter(after, {}, new APIError("UNAUTHORIZED", { message: "x" }));
    await callAfter(after, undefined, { token: "t" });
    await callAfter(after, { email: "   " }, { token: "t" });
    expect(guardCalls.clearSignInFailures).not.toHaveBeenCalled();
    expect(guardCalls.recordWrongPassword).not.toHaveBeenCalled();
    expect(guardCalls.releaseSignInAttempt).not.toHaveBeenCalled();
  });

  it("does nothing when BetterAuth returned nothing", async () => {
    const { after } = hooksOf();
    await callAfter(after, { email: EMAIL }, undefined);
    expect(guardCalls.clearSignInFailures).not.toHaveBeenCalled();
    expect(guardCalls.recordWrongPassword).not.toHaveBeenCalled();
    expect(guardCalls.releaseSignInAttempt).not.toHaveBeenCalled();
  });
});
