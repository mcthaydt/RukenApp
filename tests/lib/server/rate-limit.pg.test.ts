import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRateLimiter, RATE_LIMIT_ROWS_KEPT_MS } from "../../../src/lib/server/rate-limit.ts";
import { startTestDatabase, type TestDatabase } from "../../support/database.ts";
import { TestClock } from "../../support/test-clock.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
});

afterAll(async () => {
  await database.stop();
});

const rule = { max: 3, windowMs: 60_000 };

describe("rate limits on the RateLimit table", () => {
  it("allows up to the limit in a window, then refuses with the seconds left", async () => {
    const clock = new TestClock("2026-10-07T12:00:00Z");
    const limiter = createRateLimiter(database.prisma, clock);
    for (let i = 0; i < 3; i += 1) expect(await limiter.hit("api:test:a", rule)).toEqual({ allowed: true });
    clock.advance(20_500);
    expect(await limiter.hit("api:test:a", rule)).toEqual({ allowed: false, retryAfterSeconds: 40 });
  });

  it("starts a new window once the old one has passed", async () => {
    const clock = new TestClock("2026-10-07T12:00:00Z");
    const limiter = createRateLimiter(database.prisma, clock);
    for (let i = 0; i < 4; i += 1) await limiter.hit("api:test:b", rule);
    clock.advance(60_000);
    expect(await limiter.hit("api:test:b", rule)).toEqual({ allowed: true });
    const row = await database.prisma.rateLimit.findUnique({ where: { key: "api:test:b" } });
    expect(row?.count).toBe(1);
    expect(row?.lastRequest).toBe(BigInt(clock.epochMs()));
  });

  it("keeps keys apart", async () => {
    const clock = new TestClock("2026-10-07T12:00:00Z");
    const limiter = createRateLimiter(database.prisma, clock);
    for (let i = 0; i < 3; i += 1) await limiter.hit("api:test:c", rule);
    expect(await limiter.hit("api:test:d", rule)).toEqual({ allowed: true });
  });

  it("never admits more than the limit when hits arrive at the same time", async () => {
    const clock = new TestClock("2026-10-07T12:00:00Z");
    const limiter = createRateLimiter(database.prisma, clock);
    const results = await Promise.all(Array.from({ length: 10 }, () => limiter.hit("api:test:e", rule)));
    expect(results.filter((result) => result.allowed)).toHaveLength(3);
  });

  it("refuses a rule whose window is longer than the time counters are kept", async () => {
    const limiter = createRateLimiter(database.prisma, new TestClock("2026-10-07T12:00:00Z"));
    await expect(
      limiter.hit("api:test:long", { max: 1, windowMs: RATE_LIMIT_ROWS_KEPT_MS + 1 }),
    ).rejects.toThrow(/window/);
  });
});
