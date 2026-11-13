import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { authLimitsPlugin, RATE_LIMITED } from "../../../src/features/accounts/auth-limits-plugin.ts";
import { hashSignInEmail } from "../../../src/features/accounts/sign-in-guard.ts";
import type { RateLimiter, RateLimitResult, RateLimitRule } from "../../../src/lib/server/rate-limit.ts";
import { TestClock } from "../../support/test-clock.ts";

// The per-address limits on sign-in and password reset. The limiter is a small in-memory fixed-window
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
  };
}

function setup() {
  const clock = new TestClock("2026-11-05T15:00:00Z");
  const limiter = fakeLimiter(clock);
  const plugin = authLimitsPlugin({ limiter, secret: SECRET, clientIpHeader: IP_HEADER });
  const hook = plugin.hooks?.before?.[0];
  if (hook === undefined) throw new Error("the plugin has no before hook");
  return { clock, limiter, plugin, hook };
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

const SIGN_IN = "/sign-in/email";
const RESET = "/request-password-reset";
const EMAIL = "pat@example.test";

describe("which requests the plugin looks at", () => {
  it("is named auth-address-limits and has one hook before", () => {
    const { plugin } = setup();
    expect(plugin.id).toBe("auth-address-limits");
    expect(plugin.hooks?.before).toHaveLength(1);
    expect(plugin.hooks?.after).toBeUndefined();
  });

  it("matches password sign-in and the reset request, and nothing else", () => {
    const { hook } = setup();
    for (const path of [SIGN_IN, RESET]) expect(hook.matcher({ path } as never)).toBe(true);
    for (const path of [
      "/sign-up/email",
      "/sign-in/social",
      "/sign-in/magic-link",
      "/reset-password",
      "/sign-out",
      "/get-session",
      "/sign-in/email/",
      "/toString",
    ]) {
      expect(hook.matcher({ path } as never)).toBe(false);
    }
    expect(hook.matcher({ path: undefined } as never)).toBe(false);
  });

  it.each([
    ["no body", undefined],
    ["an empty body", {}],
    ["an empty address", { email: "" }],
    ["an address of only spaces", { email: "  " }],
    ["an address that is not text", { email: 7 }],
    ["an address that is null", { email: null }],
  ])("leaves %s for the endpoint's own checks and counts nothing", async (_name, body) => {
    const { hook, limiter } = setup();
    for (const path of [SIGN_IN, RESET]) expect(await send(hook, path, body)).toBeUndefined();
    expect(limiter.hits).toHaveLength(0);
  });
});

describe("password sign-in: 5 a minute per client address and email", () => {
  it("allows 5 tries and refuses the 6th", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 5; attempt += 1)
      expect(await send(hook, SIGN_IN, { email: EMAIL })).toBeUndefined();

    const refused = await send(hook, SIGN_IN, { email: EMAIL });
    expect(refused).toBeInstanceOf(APIError);
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
    expect(refused?.body?.message).toBe("Too many tries. Wait a little, then try again.");
  });

  it("uses the error code RATE_LIMITED", () => {
    expect(RATE_LIMITED).toBe("RATE_LIMITED");
  });

  it("asks the limiter for one key and one rule: 5 in one minute", async () => {
    const { hook, limiter } = setup();
    await send(hook, SIGN_IN, { email: EMAIL }, "203.0.113.5");
    expect(limiter.hits).toEqual([
      {
        key: `api:auth:/sign-in/email:203.0.113.5:${hashSignInEmail(EMAIL, SECRET)}`,
        rule: { max: 5, windowMs: MINUTE },
      },
    ]);
  });

  it("starts a new window a minute after the first try", async () => {
    const { hook, clock } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1) await send(hook, SIGN_IN, { email: EMAIL });

    // 1 ms short of the minute: still refused. Exactly a minute after the window began: allowed again.
    clock.advance(MINUTE - 1);
    expect((await send(hook, SIGN_IN, { email: EMAIL }))?.statusCode).toBe(429);
    clock.advance(1);
    expect(await send(hook, SIGN_IN, { email: EMAIL })).toBeUndefined();
  });

  it("does not stop the same email from another client address", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1)
      await send(hook, SIGN_IN, { email: EMAIL }, "203.0.113.5");
    expect((await send(hook, SIGN_IN, { email: EMAIL }, "203.0.113.5"))?.statusCode).toBe(429);
    expect(await send(hook, SIGN_IN, { email: EMAIL }, "198.51.100.7")).toBeUndefined();
  });

  it("does not stop another email from the same client address", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 6; attempt += 1) await send(hook, SIGN_IN, { email: EMAIL });
    expect(await send(hook, SIGN_IN, { email: "sam@example.test" })).toBeUndefined();
  });
});

describe("the reset request: 3 per 15 minutes per client address and email, 30 an hour per email", () => {
  it("allows 3 tries and refuses the 4th from one client address", async () => {
    const path = RESET;
    const { hook } = setup();
    for (let attempt = 1; attempt <= 3; attempt += 1)
      expect(await send(hook, path, { email: EMAIL })).toBeUndefined();

    const refused = await send(hook, path, { email: EMAIL });
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
  });

  it("asks the limiter first for the per client key, then for the per email key", async () => {
    const path = RESET;
    const { hook, limiter } = setup();
    const emailKey = hashSignInEmail(EMAIL, SECRET);
    await send(hook, path, { email: EMAIL }, "203.0.113.5");
    expect(limiter.hits).toEqual([
      { key: `api:auth:${path}:203.0.113.5:${emailKey}`, rule: { max: 3, windowMs: 15 * MINUTE } },
      { key: `api:auth:${path}:${emailKey}`, rule: { max: 30, windowMs: HOUR } },
    ]);
  });

  it("does not count a request the per client limit refused against the hourly ceiling", async () => {
    const { hook, limiter } = setup();
    for (let attempt = 1; attempt <= 4; attempt += 1) await send(hook, RESET, { email: EMAIL });
    // Three allowed requests asked both limits (6 asks); the 4th stopped at the first (1 ask).
    expect(limiter.hits).toHaveLength(7);
    const hourly = limiter.hits.filter((hit) => hit.rule.windowMs === HOUR);
    expect(hourly).toHaveLength(3);
  });

  it("starts a new 15 minute window 15 minutes after the first try", async () => {
    const { hook, clock } = setup();
    for (let attempt = 1; attempt <= 4; attempt += 1) await send(hook, RESET, { email: EMAIL });

    clock.advance(15 * MINUTE - 1);
    expect((await send(hook, RESET, { email: EMAIL }))?.statusCode).toBe(429);
    clock.advance(1);
    expect(await send(hook, RESET, { email: EMAIL })).toBeUndefined();
  });

  it("keeps a stranger's tries from using up the person's own three ", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 4; attempt += 1)
      await send(hook, RESET, { email: EMAIL }, "198.51.100.99");
    expect((await send(hook, RESET, { email: EMAIL }, "198.51.100.99"))?.statusCode).toBe(429);

    expect(await send(hook, RESET, { email: EMAIL }, "203.0.113.5")).toBeUndefined();
  });

  it("refuses the 31st request in an hour for one email, however many client addresses ask", async () => {
    const { hook } = setup();
    // 30 different client addresses, one try each: every per client limit is fine, the hourly one fills.
    for (let n = 1; n <= 30; n += 1)
      expect(await send(hook, RESET, { email: EMAIL }, `192.0.2.${String(n)}`)).toBeUndefined();

    const refused = await send(hook, RESET, { email: EMAIL }, "192.0.2.200");
    expect(refused?.statusCode).toBe(429);
    expect(refused?.body?.code).toBe(RATE_LIMITED);
  });

  it("starts a new hour for one email an hour after its first request", async () => {
    const { hook, clock } = setup();
    for (let n = 1; n <= 31; n += 1) await send(hook, RESET, { email: EMAIL }, `192.0.2.${String(n)}`);

    clock.advance(HOUR - 1);
    expect((await send(hook, RESET, { email: EMAIL }, "192.0.2.201"))?.statusCode).toBe(429);
    clock.advance(1);
    expect(await send(hook, RESET, { email: EMAIL }, "192.0.2.202")).toBeUndefined();
  });
});

describe("the keys", () => {
  it("hold the keyed hash of the address, never the address", async () => {
    const { hook, limiter } = setup();
    await send(hook, SIGN_IN, { email: "Pat@Example.test" });
    for (const { key } of limiter.hits) {
      expect(key.toLowerCase()).not.toContain("pat@example");
      expect(key).toContain(hashSignInEmail("pat@example.test", SECRET));
    }
  });

  it("are the same for any letter case and stray spaces in the address", async () => {
    const { hook } = setup();
    for (let attempt = 1; attempt <= 5; attempt += 1)
      await send(hook, SIGN_IN, { email: attempt % 2 === 0 ? " PAT@example.test " : "pat@example.test" });
    expect((await send(hook, SIGN_IN, { email: "Pat@Example.TEST" }))?.statusCode).toBe(429);
  });

  it("depend on the server secret", async () => {
    const clock = new TestClock("2026-11-05T15:00:00Z");
    const limiter = fakeLimiter(clock);
    const other = authLimitsPlugin({ limiter, secret: `${SECRET}-other`, clientIpHeader: IP_HEADER }).hooks
      ?.before?.[0];
    const { hook, limiter: first } = setup();
    if (other === undefined) throw new Error("no hook");
    await send(hook, SIGN_IN, { email: EMAIL });
    await send(other, SIGN_IN, { email: EMAIL });
    expect(limiter.hits[0]?.key).not.toBe(first.hits[0]?.key);
  });

  it("read the client address from the header the plugin was given, and use 'unknown' when it is missing", async () => {
    const { hook, limiter } = setup();
    const emailKey = hashSignInEmail(EMAIL, SECRET);
    await send(hook, SIGN_IN, { email: EMAIL }, null);
    expect(limiter.hits[0]?.key).toBe(`api:auth:/sign-in/email:unknown:${emailKey}`);
  });

  it("ignore a client address in a header other than the one the plugin was given", async () => {
    const { hook, limiter } = setup();
    await hook.handler({
      path: SIGN_IN,
      body: { email: EMAIL },
      headers: new Headers({ "x-forwarded-for": "198.51.100.1" }),
      context: {},
    } as never);
    expect(limiter.hits[0]?.key).toContain(":unknown:");
  });

  it("use 'unknown' when the request has no headers at all", async () => {
    const { hook, limiter } = setup();
    await hook.handler({ path: SIGN_IN, body: { email: EMAIL }, context: {} } as never);
    expect(limiter.hits[0]?.key).toContain(":unknown:");
  });
});

describe("an address with no account", () => {
  it("is limited the same way, since the plugin never looks at accounts", async () => {
    const { hook } = setup();
    const results: (number | undefined)[] = [];
    for (let attempt = 1; attempt <= 6; attempt += 1)
      results.push((await send(hook, SIGN_IN, { email: "nobody-here@example.test" }))?.statusCode);
    expect(results).toEqual([undefined, undefined, undefined, undefined, undefined, 429]);
  });
});
