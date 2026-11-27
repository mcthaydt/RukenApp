import { describe, expect, it } from "vitest";
import { isSendLimits, sendLimitsFrom, STAND_IN_SEND_LIMITS } from "../../../src/features/sends/limits.ts";

// The send limits (games-sent-to-you brief, "A limit on sending"): the private Worker's when it is bound and answers in
// shape, the public stand-ins otherwise, so the deploy's numbers never have to be in this repo.

const PRIVATE = { rules: [{ name: "minute", rule: { max: 2, windowMs: 60_000 } }] };

describe("the send limits", () => {
  it("are the stand-ins when the private Worker is not bound", async () => {
    expect(await sendLimitsFrom(null)).toBe(STAND_IN_SEND_LIMITS);
  });

  it("are the private Worker's answer when it gives one", async () => {
    expect(await sendLimitsFrom(() => Promise.resolve(PRIVATE))).toEqual(PRIVATE);
  });

  it("are the stand-ins when the private Worker throws", async () => {
    expect(await sendLimitsFrom(() => Promise.reject(new Error("down")))).toBe(STAND_IN_SEND_LIMITS);
    expect(
      await sendLimitsFrom(() => {
        throw new Error("no such method");
      }),
    ).toBe(STAND_IN_SEND_LIMITS);
  });

  it("are the stand-ins when the answer is not in shape", async () => {
    for (const answer of [
      null,
      undefined,
      {},
      { rules: [] },
      { rules: [{ name: "", rule: { max: 1, windowMs: 1 } }] },
      { rules: [{ name: "hour", rule: { max: 0, windowMs: 1 } }] },
      { rules: [{ name: "hour", rule: { max: 1.5, windowMs: 1 } }] },
      { rules: [{ name: "hour", rule: { max: 1 } }] },
      { rules: "lots" },
    ]) {
      expect(isSendLimits(answer)).toBe(false);
      expect(await sendLimitsFrom(() => Promise.resolve(answer))).toBe(STAND_IN_SEND_LIMITS);
    }
  });

  it("stand-ins are in shape themselves", () => {
    expect(isSendLimits(STAND_IN_SEND_LIMITS)).toBe(true);
  });
});
