import { expect, test } from "@playwright/test";
import { copyStamp } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// The journeys' site is started as the live copy (playwright.config.ts), and claims its database the way the deploy
// command does, before it starts. A database with no stamp would make every page answer 503.

test("the journeys' database is stamped as the live copy's", async () => {
  expect(await copyStamp()).toBe("live");
});
