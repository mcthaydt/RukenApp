import { afterEach, describe, expect, it, vi } from "vitest";
import { freshNumber } from "./browser/support/account.ts";

// A number that already has an account gets no code, so two journeys that drew the same number fail the second one's
// sign-up. Drawn at random from the whole range, 50,000 draws repeat about 200 times; these must not repeat at all.
describe("the journeys' fresh numbers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never hands out the same number twice", () => {
    vi.stubEnv("TEST_PARALLEL_INDEX", "1");
    const drawn = Array.from({ length: 50_000 }, () => freshNumber());
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("gives each worker its own area codes, with 555 and no 01·· line", () => {
    vi.stubEnv("TEST_PARALLEL_INDEX", "3");
    for (let i = 0; i < 1_000; i += 1) {
      const number = freshNumber();
      expect(number).toMatch(/^\+15\d\d555\d{4}$/);
      expect(number.slice(-4).startsWith("01")).toBe(false);
    }
  });
});
