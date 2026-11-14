import { describe, expect, it } from "vitest";
import { isOpen, LAUNCH_MS, OPENS_WORDS } from "../../../src/features/launch/switch.ts";

// Ruken opens at 11:00 in Chicago on 30 November 2026 (design: one launch switch). Chicago is on standard time
// that day, so that is 17:00 UTC.

describe("the launch switch", () => {
  it("opens at 11:00 in Chicago on 30 November 2026, and not a moment before", () => {
    expect(LAUNCH_MS).toBe(Date.UTC(2026, 10, 30, 17, 0, 0));
    expect(isOpen(LAUNCH_MS - 1_000)).toBe(false); // 10:59:59
    expect(isOpen(LAUNCH_MS - 1)).toBe(false);
    expect(isOpen(LAUNCH_MS)).toBe(true); // 11:00:00
  });

  it("stays open", () => {
    expect(isOpen(LAUNCH_MS + 400 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("says the day it opens, and the words cannot drift from the moment", () => {
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Chicago",
      day: "numeric",
      month: "long",
    }).format(LAUNCH_MS);
    expect(OPENS_WORDS).toBe(`Opens ${day}`);
  });
});
