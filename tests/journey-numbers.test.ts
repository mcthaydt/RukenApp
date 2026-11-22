import { afterEach, describe, expect, it, vi } from "vitest";

// A number that already has an account gets no code, so two journeys that drew the same number fail the second one's
// sign-up at "no code waiting". Every worker process of a run shares one database, so no two may draw the same number.
//
// Playwright starts a new worker process for each device profile, and another after a failure, and the new one takes
// the same TEST_PARALLEL_INDEX as the one before it, with nothing remembered. TEST_WORKER_INDEX is the process's own.
// Each case loads the helper fresh, as a new process would.

async function freshNumberOf(worker: { parallel: number; process: number }): Promise<() => string> {
  vi.resetModules();
  vi.stubEnv("TEST_PARALLEL_INDEX", String(worker.parallel));
  vi.stubEnv("TEST_WORKER_INDEX", String(worker.process));
  const { freshNumber } = await import("./browser/support/account.ts");
  return freshNumber;
}

describe("the journeys' fresh numbers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("never hands out the same number twice in one worker", async () => {
    const freshNumber = await freshNumberOf({ parallel: 1, process: 1 });
    const drawn = Array.from({ length: 50_000 }, () => freshNumber());
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it("never hands out a number another worker process of the run had, though they take the same parallel index", async () => {
    // One parallel index, as phone, tablet and computer each start a worker in its place, and two more after failures.
    const drawn: string[] = [];
    for (let process = 0; process < 5; process += 2) {
      const freshNumber = await freshNumberOf({ parallel: 0, process });
      drawn.push(...Array.from({ length: 5_000 }, () => freshNumber()));
    }
    // And the other parallel index's workers beside them.
    for (let process = 1; process < 6; process += 2) {
      const freshNumber = await freshNumberOf({ parallel: 1, process });
      drawn.push(...Array.from({ length: 5_000 }, () => freshNumber()));
    }
    expect(drawn.length - new Set(drawn).size).toBe(0);
  });

  it("is +1, an area code, 555 and a line outside 01··", async () => {
    const freshNumber = await freshNumberOf({ parallel: 3, process: 17 });
    for (let i = 0; i < 1_000; i += 1) {
      const number = freshNumber();
      expect(number).toMatch(/^\+1[2-9]\d\d555\d{4}$/);
      expect(number.slice(-4).startsWith("01")).toBe(false);
    }
  });

  it("says so when one worker has used up its numbers, instead of looping for ever", async () => {
    const freshNumber = await freshNumberOf({ parallel: 0, process: 2 });
    // A worker owns 78,000 numbers; more draws than that must stop with the reason.
    expect(() => {
      for (let i = 0; i < 80_000; i += 1) freshNumber();
    }).toThrow(/used up/);
  });
});
