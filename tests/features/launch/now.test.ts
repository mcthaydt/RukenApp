import { describe, expect, it } from "vitest";
import { createLaunchNow } from "../../../src/features/launch/now.ts";
import { isOpen } from "../../../src/features/launch/switch.ts";
import { TestClock } from "../../support/test-clock.ts";

// Every route asks for the launch time through createLaunchNow. On the real site it is the real clock. The journeys'
// site sets LAUNCH_TEST_SWITCH so that every journey of the earlier slices (they press Play) does not change with the date.

const clock = new TestClock("2026-11-20T12:00:00Z");
const none = { get: () => undefined };
const before = { get: (name: string) => (name === "rk_test_launch" ? "before" : undefined) };

describe("the launch time a request sees", () => {
  it("reads the real clock when the switch is not set, whatever cookie comes", () => {
    const now = createLaunchNow({ BETTER_AUTH_URL: "https://ruken.example" }, clock);
    expect(now(none)).toBe(clock.epochMs());
    expect(now(before)).toBe(clock.epochMs());
  });

  it("treats an empty switch as not set", () => {
    const now = createLaunchNow({ LAUNCH_TEST_SWITCH: "", BETTER_AUTH_URL: "https://ruken.example" }, clock);
    expect(now(before)).toBe(clock.epochMs());
  });

  it.each(["https://ruken.example", "https://localhost:4173", "http://localhost.evil.example", "not a url", undefined])(
    "refuses to start with the switch on at %j",
    (address) => {
      expect(() => createLaunchNow({ LAUNCH_TEST_SWITCH: "on", BETTER_AUTH_URL: address }, clock)).toThrow(
        "LAUNCH_TEST_SWITCH is for tests on this machine",
      );
    },
  );

  it.each(["true", "off", "ON"])("refuses a value it does not know (%j)", (value) => {
    expect(() =>
      createLaunchNow({ LAUNCH_TEST_SWITCH: value, BETTER_AUTH_URL: "http://localhost:4173" }, clock),
    ).toThrow("LAUNCH_TEST_SWITCH is for tests on this machine. Remove it from this site's settings.");
  });

  it.each(["http://localhost:4173", "http://127.0.0.1:4173"])(
    "on this machine (%s) the site is open, and one cookie makes it the day before",
    (address) => {
      const now = createLaunchNow({ LAUNCH_TEST_SWITCH: "on", BETTER_AUTH_URL: address }, clock);
      expect(isOpen(now(none))).toBe(true);
      expect(isOpen(now(before))).toBe(false);
      expect(isOpen(now({ get: () => "after" }))).toBe(true);
    },
  );
});
