import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import {
  authLimitsPlugin,
  CODE_TOO_SOON,
  CODES_PAUSED,
  codesPausedFor,
  countWrongCode,
  RATE_LIMITED,
  WRONG_CODES,
} from "../../../src/features/accounts/auth-limits-plugin.ts";
import { hashNumber } from "../../../src/features/accounts/phone.ts";
import type { RateLimiter, RateLimitResult, RateLimitRule } from "../../../src/lib/server/rate-limit.ts";
import { TestClock } from "../../support/test-clock.ts";

// The per-number limits on sign-in, on asking for a code and on typing one. The limiter is a small in-memory fixed-window
// counter driven by a TestClock, with the same rule as the real one (src/lib/server/rate-limit.ts): the first
// `max` requests in a window pass, the next are refused, and a request after the window starts a
// new one. That lets the tests check both which keys and rules the plugin uses, and what a person
// sees as the minutes go by.
//
// The "starts a new window" tests below show what a person sees *given* that rule. The plugin has no
// window logic of its own: the real edges are pinned in tests/lib/server/rate-limit.pg.test.ts. If the real limiter's
// rule changes, change this fake with it. The key and rule assertions are the plugin's own contract.

const SECRET = "test-secret-that-is-long-enough";
const IP_HEADER = "x-test-client-ip";
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

interface Hit {
  key: string;
  rule: RateLimitRule;
}

/** A fixed-window limiter in memory. `hits` lists every call in order, for checking keys and rules. */
function fakeLimiter(clock: TestClock): RateLimiter & { hits: Hit[] } {
  const windows = new Map<string, { count: number; startedAt: number }>();
  const hits: Hit[] = [];
  return {
    hits,
    hit(key, rule): Promise<RateLimitResult> {
      hits.push({ key, rule });
      const now = clock.epochMs();
      const current = windows.get(key);
      const window =
        current === undefined || current.startedAt <= now - rule.windowMs
          ? { count: 1, startedAt: now }
          : { count: current.count + 1, startedAt: current.startedAt };
      windows.set(key, window);
      return Promise.resolve(
        window.count <= rule.max ? { allowed: true } : { allowed: false, retryAfterSeconds: 1 },
      );
    },
    count(key, rule): Promise<number> {
      const current = windows.get(key);
      return Promise.resolve(
        current === undefined || current.startedAt <= clock.epochMs() - rule.windowMs ? 0 : current.count,
      );
    },
  };
}

function setup() {
  const clock = new TestClock("2026-11-05T15:00:00Z");
  const limiter = fakeLimiter(clock);
  const plugin = authLimitsPlugin({ limiter, secret: SECRET, clientIpHeader: IP_HEADER });
  const [hook, pausedHook] = plugin.hooks?.before ?? [];
  const afterHook = plugin.hooks?.after?.[0];
  if (hook === undefined || pausedHook === undefined || afterHook === undefined)
    throw new Error("the plugin is missing a hook");
  return { clock, limiter, plugin, hook, pausedHook, afterHook };
}

type Hook = ReturnType<typeof setup>["hook"];

/** Sends one request through the hook; resolves to undefined when allowed, or to the refusal. */
async function send(
  hook: Hook,
  path: string,
  body: unknown,
  ip: string | null = "203.0.113.5",
): Promise<APIError | undefined> {
  const headers = new Headers();
  if (ip !== null) headers.set(IP_HEADER, ip);
  try {
    await hook.handler({ path, body, headers, context: {} } as never);
    return undefined;
  } catch (error) {
    if (error instanceof APIError) return error;
    throw error;
  }
}

const SIGN_IN = "/sign-in/phone-number";
const SEND = "/phone-number/send-otp";
const RESET = "/phone-number/request-password-reset";
const VERIFY = "/phone-number/verify";
const FINISH = "/phone-number/reset-password";
const NUMBER = "+13125551234";
const OTHER_NUMBER = "+13125559876";

describe("which requests the plugin looks at", () => {
  it("is named auth-number-limits, with two hooks before and one after", () => {
    const { plugin } = setup();
    expect(plugin.id).toBe("auth-number-limits");
    expect(plugin.hooks?.before).toHaveLength(2);
    expect(plugin.hooks?.after).toHaveLength(1);
  });

  it("limits password sign-in and the two code requests, and nothing else", () => {
    const { hook } = setup();
    for (const path of [SIGN_IN, SEND, RESET]) expect(hook.matcher({ path } as never)).toBe(true);
    for (const path of [
      VERIFY,
      FINISH,
      "/sign-in/email",
      "/sign-up/email",
      "/sign-in/social",
      "/sign-out",
      "/get-session",
      "/sign-in/phone-number/",
      "/toString",
    ]) {
      expect(hook.matcher({ path } as never)).toBe(false);
    }
    expect(hook.matcher({ path: undefined } as never)).toBe(false);
  });

  it.each([
    ["no body", undefined],
    ["an empty body", {}],
    ["an empty number", { phoneNumber: "" }],
    ["a number of only spaces", { phoneNumber: "  " }],
    ["a number that is not text", { phoneNumber: 7 }],
    ["a number that is null", { phoneNumber: null }],
  ])("leaves %s for the endpoint's own checks and counts nothing", async (_name, body) => {
    const { hook, limiter } = setup();
    for (const path of [SIGN_IN, SEND, RESET]) expect(await send(hook, path, body)).toBeUndefined();
    expect(limiter.hits).toHaveLength(0);
  });
});

describe("password sign-in: 5 a minute per client address and number", () => {
  it("allows 5 tries and refuses the 6th", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 5; attempt += 1)
      expect(await send(hook, SIGN_IN, { phoneNumber: NUMBER })).toBeUndefined();

    const refused = await send(hook, SIGN_IN, { phoneNumber: NUMBER });
    expect(refused).toBeInstanceOf(APIError);
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
    expect(refused?.body?.message).toBe("Too many tries. Wait a little, then try again.");
  });

  it("uses the error codes RATE_LIMITED, CODE_TOO_SOON and CODES_PAUSED", () => {
    expect(RATE_LIMITED).toBe("RATE_LIMITED");
    expect(CODE_TOO_SOON).toBe("CODE_TOO_SOON");
    expect(CODES_PAUSED).toBe("CODES_PAUSED");
  });

  it("asks the limiter for one key and one rule: 5 in one minute", async () => {
    const { hook, limiter } = setup();
    await send(hook, SIGN_IN, { phoneNumber: NUMBER }, "203.0.113.5");
    expect(limiter.hits).toEqual([
      {
        key: `api:auth:${SIGN_IN}:203.0.113.5:${hashNumber(NUMBER, SECRET)}`,
        rule: { max: 5, windowMs: MINUTE },
      },
    ]);
  });

  it("starts a new window a minute after the first try", async () => {
    const { hook, clock } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1) await send(hook, SIGN_IN, { phoneNumber: NUMBER });

    clock.advance(MINUTE - 1);
    expect((await send(hook, SIGN_IN, { phoneNumber: NUMBER }))?.statusCode).toBe(429);
    clock.advance(1);
    expect(await send(hook, SIGN_IN, { phoneNumber: NUMBER })).toBeUndefined();
  });

  it("does not stop the same number from another client address", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1)
      await send(hook, SIGN_IN, { phoneNumber: NUMBER }, "203.0.113.5");
    expect((await send(hook, SIGN_IN, { phoneNumber: NUMBER }, "203.0.113.5"))?.statusCode).toBe(429);
    expect(await send(hook, SIGN_IN, { phoneNumber: NUMBER }, "198.51.100.7")).toBeUndefined();
  });

  it("does not stop another number from the same client address", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1) await send(hook, SIGN_IN, { phoneNumber: NUMBER });
    expect(await send(hook, SIGN_IN, { phoneNumber: OTHER_NUMBER })).toBeUndefined();
  });
});

describe.each([SEND, RESET])("asking for a code at %s", (path) => {
  const key = (rest: string): string => `api:auth:${path}:${rest}`;
  const numberKey = hashNumber(NUMBER, SECRET);

  it("asks the limiter for the per-client key, then the 30 second key, then the hourly key", async () => {
    const { hook, limiter } = setup();
    await send(hook, path, { phoneNumber: NUMBER }, "203.0.113.5");
    expect(limiter.hits).toEqual([
      { key: key(`203.0.113.5:${numberKey}`), rule: { max: 3, windowMs: 15 * MINUTE } },
      { key: key(`${numberKey}:soon`), rule: { max: 1, windowMs: 30_000 } },
      { key: key(numberKey), rule: { max: 10, windowMs: HOUR } },
    ]);
  });

  it("refuses a second ask inside 30 seconds as 'too soon', whoever asks, and allows one after", async () => {
    const { hook, clock } = setup();
    expect(await send(hook, path, { phoneNumber: NUMBER }, "203.0.113.5")).toBeUndefined();
    clock.advance(10_000);
    const refused = await send(hook, path, { phoneNumber: NUMBER }, "198.51.100.7");
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(CODE_TOO_SOON);
    expect(refused?.body?.message).toBe("Give it a few seconds, then try again.");
    clock.advance(20_001);
    expect(await send(hook, path, { phoneNumber: NUMBER }, "192.0.2.9")).toBeUndefined();
  });

  it("allows 3 asks in 15 minutes from one client address and refuses the 4th", async () => {
    const { hook, clock } = setup();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      expect(await send(hook, path, { phoneNumber: NUMBER })).toBeUndefined();
      clock.advance(31_000);
    }
    const refused = await send(hook, path, { phoneNumber: NUMBER });
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
  });

  it("keeps a stranger's asks from using up the person's own three", async () => {
    const { hook, clock } = setup();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await send(hook, path, { phoneNumber: NUMBER }, "198.51.100.99");
      clock.advance(31_000);
    }
    expect((await send(hook, path, { phoneNumber: NUMBER }, "198.51.100.99"))?.body?.code).toBe(RATE_LIMITED);
    expect(await send(hook, path, { phoneNumber: NUMBER }, "203.0.113.5")).toBeUndefined();
  });

  it("refuses the 11th ask in an hour for one number, however many client addresses ask", async () => {
    const { hook, clock } = setup();
    for (let n = 1; n <= 10; n += 1) {
      expect(await send(hook, path, { phoneNumber: NUMBER }, `192.0.2.${String(n)}`)).toBeUndefined();
      clock.advance(31_000);
    }
    const refused = await send(hook, path, { phoneNumber: NUMBER }, "192.0.2.200");
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
  });

  it("starts a new hour for one number an hour after its first ask", async () => {
    const { hook, clock } = setup();
    for (let n = 1; n <= 11; n += 1) {
      await send(hook, path, { phoneNumber: NUMBER }, `192.0.2.${String(n)}`);
      clock.advance(31_000);
    }
    expect((await send(hook, path, { phoneNumber: NUMBER }, "192.0.2.201"))?.statusCode).toBe(429);
    clock.advance(HOUR);
    expect(await send(hook, path, { phoneNumber: NUMBER }, "192.0.2.202")).toBeUndefined();
  });

  it("limits a number with no account the same way, since the plugin never looks at accounts", async () => {
    const { hook, clock } = setup();
    const results: (string | undefined)[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      results.push((await send(hook, path, { phoneNumber: "+13125550000" }))?.body?.code);
      clock.advance(31_000);
    }
    expect(results).toEqual([undefined, undefined, undefined, RATE_LIMITED]);
  });
});

describe("the keys", () => {
  it("hold the keyed hash of the number, never the number", async () => {
    const { hook, limiter } = setup();
    await send(hook, SIGN_IN, { phoneNumber: NUMBER });
    await send(hook, SEND, { phoneNumber: NUMBER });
    for (const { key } of limiter.hits) {
      expect(key).not.toContain("3125551234");
      expect(key).toContain(hashNumber(NUMBER, SECRET));
    }
  });

  it("depend on the server secret", async () => {
    const clock = new TestClock("2026-11-05T15:00:00Z");
    const limiter = fakeLimiter(clock);
    const other = authLimitsPlugin({ limiter, secret: `${SECRET}-other`, clientIpHeader: IP_HEADER }).hooks
      ?.before?.[0];
    const { hook, limiter: first } = setup();
    if (other === undefined) throw new Error("no hook");
    await send(hook, SIGN_IN, { phoneNumber: NUMBER });
    await send(other, SIGN_IN, { phoneNumber: NUMBER });
    expect(limiter.hits[0]?.key).not.toBe(first.hits[0]?.key);
  });

  it("read the client address from the header the plugin was given, and use 'unknown' when it is missing", async () => {
    const { hook, limiter } = setup();
    await send(hook, SIGN_IN, { phoneNumber: NUMBER }, null);
    expect(limiter.hits[0]?.key).toBe(`api:auth:${SIGN_IN}:unknown:${hashNumber(NUMBER, SECRET)}`);
  });

  it("ignore a client address in a header other than the one the plugin was given", async () => {
    const { hook, limiter } = setup();
    await hook.handler({
      path: SIGN_IN,
      body: { phoneNumber: NUMBER },
      headers: new Headers({ "x-forwarded-for": "198.51.100.1" }),
      context: {},
    } as never);
    expect(limiter.hits[0]?.key).toContain(":unknown:");
  });

  it("use 'unknown' when the request has no headers at all", async () => {
    const { hook, limiter } = setup();
    await hook.handler({ path: SIGN_IN, body: { phoneNumber: NUMBER }, context: {} } as never);
    expect(limiter.hits[0]?.key).toContain(":unknown:");
  });
});

describe("wrong codes: ten in an hour pause codes for the number", () => {
  const wrong = () => new APIError("BAD_REQUEST", { message: "Invalid OTP", code: "INVALID_OTP" });
  const tooMany = () =>
    new APIError("FORBIDDEN", { message: "Too many attempts", code: "TOO_MANY_ATTEMPTS" });

  it("is ten in an hour", () => {
    expect(WRONG_CODES).toEqual({ max: 10, windowMs: HOUR });
  });

  it("counts a wrong code and a code that ran out of tries, at the typing and at the reset, and nothing else", async () => {
    const { afterHook, limiter } = setup();
    const run = (path: string, returned: unknown) =>
      afterHook.handler({
        path,
        body: { phoneNumber: NUMBER },
        headers: new Headers(),
        context: { returned },
      } as never);
    for (const path of [VERIFY, FINISH]) {
      await run(path, wrong());
      await run(path, tooMany());
    }
    expect(limiter.hits).toHaveLength(4);
    expect(limiter.hits[0]?.key).toBe(`api:auth:wrong-code:${hashNumber(NUMBER, SECRET)}`);

    await run(VERIFY, { status: true });
    await run(VERIFY, new APIError("BAD_REQUEST", { message: "OTP expired", code: "OTP_EXPIRED" }));
    await run(VERIFY, new APIError("BAD_REQUEST", { message: "OTP not found", code: "OTP_NOT_FOUND" }));
    await run(VERIFY, undefined);
    expect(limiter.hits).toHaveLength(4);
    // The hook is only called for the two routes that check a code.
    for (const path of [VERIFY, FINISH]) expect(afterHook.matcher({ path } as never)).toBe(true);
    for (const path of [SEND, RESET, SIGN_IN]) expect(afterHook.matcher({ path } as never)).toBe(false);
  });

  it("refuses codes and asks once ten wrong ones are counted, and not before", async () => {
    const { pausedHook, hook, afterHook, clock, limiter } = setup();
    const wrongAt = (path: string) =>
      afterHook.handler({
        path,
        body: { phoneNumber: NUMBER },
        headers: new Headers(),
        context: { returned: wrong() },
      } as never);
    for (let attempt = 1; attempt <= 9; attempt += 1) await wrongAt(VERIFY);
    for (const path of [SEND, RESET, VERIFY, FINISH])
      expect(await send(pausedHook, path, { phoneNumber: NUMBER })).toBeUndefined();

    await wrongAt(FINISH);
    for (const path of [SEND, RESET, VERIFY, FINISH]) {
      const refused = await send(pausedHook, path, { phoneNumber: NUMBER });
      expect(refused?.statusCode).toBe(429);
      expect(refused?.body?.code).toBe(CODES_PAUSED);
      expect(refused?.body?.message).toBe(
        "Too many wrong codes. Codes are paused for an hour for this number.",
      );
    }
    // Another number is not paused, and the pause check counts nothing itself.
    expect(await send(pausedHook, SEND, { phoneNumber: OTHER_NUMBER })).toBeUndefined();
    expect(limiter.hits.filter((hit) => hit.key.includes("wrong-code"))).toHaveLength(10);
    // It also says nothing about who has an account: no hook here looks at one, and a request it refuses never
    // reaches the address limits.
    const hitsBefore = limiter.hits.length;
    await send(pausedHook, SEND, { phoneNumber: NUMBER });
    expect(limiter.hits).toHaveLength(hitsBefore);
    expect(hook.matcher({ path: SEND } as never)).toBe(true);

    clock.advance(HOUR);
    expect(await send(pausedHook, SEND, { phoneNumber: NUMBER })).toBeUndefined();
  });

  it("is something the sign-up form can run for a number whose code it checks itself", async () => {
    const clock = new TestClock("2026-11-05T15:00:00Z");
    const deps = { limiter: fakeLimiter(clock), secret: SECRET };
    expect(await codesPausedFor(deps, NUMBER)).toBe(false);
    for (let attempt = 1; attempt <= 10; attempt += 1) await countWrongCode(deps, NUMBER);
    expect(await codesPausedFor(deps, NUMBER)).toBe(true);
    expect(await codesPausedFor(deps, OTHER_NUMBER)).toBe(false);
  });
});
