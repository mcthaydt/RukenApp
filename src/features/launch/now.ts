import type { Clock } from "../../lib/clock.ts";
import { LAUNCH_MS } from "./switch.ts";

// What time every launch decision is made at. Every route asks for it through here and never reads a clock itself, so
// the one place a test can change launch is this file.

/** The cookie a journey sets to see the site as it is the day before launch. */
export const TEST_LAUNCH_COOKIE = "rk_test_launch";

const DAY_MS = 86_400_000;

/** The only addresses the switch may be used on: this machine, over plain http, as the journeys run. */
const THIS_MACHINE = new Set(["localhost", "127.0.0.1"]);

function isThisMachine(address: string | undefined): boolean {
  if (address === undefined) return false;
  try {
    const url = new URL(address);
    return url.protocol === "http:" && THIS_MACHINE.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The launch time a request sees, from the cookies it came with.
 *
 * On the real site (no switch) it is the real clock, and a cookie is never read. The journeys' site sets
 * LAUNCH_TEST_SWITCH=on, and is open whatever the date: every journey of the earlier slices presses Play and must not
 * change with the day it runs. One cookie, `rk_test_launch=before`, makes a browser see the day before launch.
 *
 * Any other value of the switch, or the switch on a site whose own address is not this machine, throws, so a real site
 * that has it set by mistake fails its pages instead of opening early. An empty value counts as not set, as every
 * other setting does.
 */
export function createLaunchNow(
  settings: { LAUNCH_TEST_SWITCH?: string | undefined; BETTER_AUTH_URL?: string | undefined },
  clock: Clock,
): (cookies: { get(name: string): string | undefined }) => number {
  const flag = settings.LAUNCH_TEST_SWITCH;
  if (flag === undefined || flag === "") return () => clock.epochMs();

  if (flag !== "on" || !isThisMachine(settings.BETTER_AUTH_URL)) {
    throw new Error("LAUNCH_TEST_SWITCH is for tests on this machine. Remove it from this site's settings.");
  }
  return (cookies) =>
    cookies.get(TEST_LAUNCH_COOKIE) === "before" ? LAUNCH_MS - DAY_MS : LAUNCH_MS + DAY_MS;
}
