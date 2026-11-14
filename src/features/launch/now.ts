import type { Clock } from "../../lib/clock.ts";

/** The cookie a journey sets to see the site as it is the day before launch. */
export const TEST_LAUNCH_COOKIE = "rk_test_launch";

/** Stub: the real function is written in the next commit. */
export function createLaunchNow(
  settings: { LAUNCH_TEST_SWITCH?: string; BETTER_AUTH_URL?: string },
  clock: Clock,
): (cookies: { get(name: string): string | undefined }) => number {
  throw new Error(`not built yet: createLaunchNow ${String(settings.LAUNCH_TEST_SWITCH)} ${String(clock.epochMs())}`);
}
