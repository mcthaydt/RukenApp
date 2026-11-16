import { expect, test } from "@playwright/test";
import { signUp, signUpInItsOwnContext } from "./support/account.ts";
import { signUpsCountedFrom } from "./support/database.ts";
import { forgetRateLimits, journeyClientAddress } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// Journeys in different workers run side by side, and the site counts sign-ups per client address. If they all
// arrived from the runner's one address their sign-ups would add up and one would be told "Too many tries"
// (seen when running the journeys locally). Each worker has its own address, in the config's page and in a browser
// made by hand, so the site counts this worker's sign-ups under that address and nobody else's.
test("a worker's sign-ups are counted under its own address", async ({ page, browser }) => {
  await signUp(page);
  await signUpInItsOwnContext(browser);
  expect(await signUpsCountedFrom(journeyClientAddress())).toBe(2);
});
