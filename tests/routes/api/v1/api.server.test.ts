import { afterEach, describe, expect, it, vi } from "vitest";
import type { RateLimiter, RateLimitRule } from "../../../../src/lib/server/rate-limit.ts";
import { Answered, api, countUpload, maker } from "../../../../src/routes/api/v1/api.server.ts";

// What every maker endpoint shares: who the key is for, the limits that count a maker (not a key), and a failure that
// never carries the key.

/** A limiter that counts by key and never lets a window pass. */
function countingLimiter(): RateLimiter & { keys: string[] } {
  const counts = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    hit(key: string, rule: RateLimitRule) {
      keys.push(key);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve(
        count <= rule.max ? { allowed: true } : { allowed: false, retryAfterSeconds: 60 },
      );
    },
    count: (key: string) => Promise.resolve(counts.get(key) ?? 0),
  };
}

const computer = (keyId: string) => ({
  locals: { caller: { kind: "computer" as const, userId: "maker_1", keyId } },
});

async function answerOf(call: Promise<unknown>): Promise<{ status: number; body: unknown } | null> {
  try {
    await call;
    return null;
  } catch (thrown) {
    if (!(thrown instanceof Answered)) throw thrown;
    return { status: thrown.response.status, body: await thrown.response.json() };
  }
}

describe("a maker's requests", () => {
  it("allow 120 a minute, the 121st is a 429 in plain words, and two keys of one maker share the count", async () => {
    const limiter = countingLimiter();
    for (let n = 0; n < 60; n += 1) {
      expect(await maker(computer("key_a") as never, limiter)).toBe("maker_1");
      expect(await maker(computer("key_b") as never, limiter)).toBe("maker_1");
    }
    expect(await answerOf(maker(computer("key_a") as never, limiter))).toEqual({
      status: 429,
      body: { problem: "Wait a minute and try again." },
    });
    expect(new Set(limiter.keys).size).toBe(1);
  });

  it("are refused with the sign-in words when there is no working key", async () => {
    const answer = await answerOf(
      maker({ locals: { caller: { kind: "none" } } } as never, countingLimiter()),
    );
    expect(answer?.status).toBe(401);
    expect(JSON.stringify(answer?.body)).toContain("Sign in again");
  });
});

describe("a maker's uploads", () => {
  it("allow 30 an hour, the 31st is a 429 in plain words", async () => {
    const limiter = countingLimiter();
    for (let n = 0; n < 30; n += 1) await countUpload("maker_1", limiter);
    expect(await answerOf(countUpload("maker_1", limiter))).toEqual({
      status: 429,
      body: { problem: "Wait a minute and try again." },
    });
    // Another maker's count is their own.
    await expect(countUpload("maker_2", limiter)).resolves.toBeUndefined();
  });
});

describe("a failure", () => {
  afterEach(() => vi.restoreAllMocks());

  it("answers a plain 500 and writes nothing of the key or the request to any log", async () => {
    const key = `rk_${"a".repeat(52)}`;
    const logged: unknown[][] = [];
    for (const method of ["log", "error", "warn", "info", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args));
    }
    const event = {
      request: new Request("https://ruken.io/api/v1/me", { headers: { authorization: `Bearer ${key}` } }),
      url: new URL("https://ruken.io/api/v1/me"),
    };
    const answer = await api(() => Promise.reject(new Error(`broke while holding Bearer ${key}`)))(
      event as never,
    );
    expect(answer.status).toBe(500);
    expect(JSON.stringify(await answer.json())).not.toContain(key);
    expect(logged.length).toBeGreaterThan(0);
    expect(JSON.stringify(logged)).not.toContain(key);
  });
});
