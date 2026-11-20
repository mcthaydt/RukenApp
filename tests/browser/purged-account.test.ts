import { expect, test, type Page } from "@playwright/test";
import { freshNumber, JOURNEY_PASSWORD, nationalOf, signUp } from "./support/account.ts";
import { forgetCodeLimits, makeDeletionDue, numberOfId, userIdOf } from "./support/database.ts";
import { shownAs } from "../../src/features/accounts/phone.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// Fourteen days after a person asks to be deleted, the daily job finishes it (design 5.8). This is that morning, as
// the person who asked meets it. The job's own answers are in purge-job.test.ts; the 14 days are moved by the database
// (see makeDeletionDue), and the job runs for real.
const SECRET = "test-only-jobs-secret";

async function askToBeDeleted(page: Page, number: string): Promise<void> {
  await signUp(page, number);
  await page.goto("/me");
  await page.getByRole("link", { name: "Delete my account" }).click();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
}

async function runTheDailyJob(page: Page): Promise<number> {
  const answer = await page.request.post("/jobs/purge-accounts", {
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
  });
  expect(answer.status()).toBe(200);
  return ((await answer.json()) as { purged: number }).purged;
}

test("after the 14 days the account is gone: sign-in is refused, and the number is free to use again", async ({
  page,
}) => {
  const number = freshNumber();
  await askToBeDeleted(page, number);
  const userId = await userIdOf(number);
  await makeDeletionDue(number);

  expect(await runTheDailyJob(page)).toBeGreaterThanOrEqual(1);

  // The old password opens nothing, and the page says what it says to anyone with the wrong password.
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That number and password don't match. Try again, or reset your password."),
  ).toBeVisible();
  // The old account keeps no number: the tombstone holds nothing of the person.
  expect(await numberOfId(userId)).toBeNull();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);

  // The same number makes a new account, which is a new person's, not the old one come back.
  // The first code for this number was sent a moment ago; the site makes a second one wait half a minute.
  await forgetCodeLimits(number);
  await signUp(page, number);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(shownAs(number)).first()).toBeVisible();
  expect(await userIdOf(number)).not.toBe(userId);
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toHaveCount(0);
});

test("the daily job does not finish an account whose 14 days are not over", async ({ page }) => {
  const number = freshNumber();
  await askToBeDeleted(page, number);

  await runTheDailyJob(page);

  // Still within the 14 days, so signing in still undoes it.
  await page.goto("/sign-in?next=%2Fme");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toBeVisible();
});
