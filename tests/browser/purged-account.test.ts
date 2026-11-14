import { expect, test, type Page } from "@playwright/test";
import { JOURNEY_PASSWORD, signUp } from "./support/account.ts";
import { makeDeletionDue } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// Fourteen days after a person asks to be deleted, the daily job finishes it (design 5.8). This is that morning, as
// the person who asked meets it. The job's own answers are in purge-job.test.ts; the 14 days are moved by the database
// (see makeDeletionDue), and the job runs for real.
const SECRET = "test-only-jobs-secret";

async function askToBeDeleted(page: Page, email: string): Promise<void> {
  await signUp(page, email);
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

test("after the 14 days the account is gone: sign-in is refused, and the address is free to use again", async ({
  page,
}) => {
  const email = `journey+gone-${crypto.randomUUID().slice(0, 12)}@ruken.test`;
  await askToBeDeleted(page, email);
  await makeDeletionDue(email);

  expect(await runTheDailyJob(page)).toBeGreaterThanOrEqual(1);

  // The old password opens nothing, and the page says what it says to anyone with the wrong password.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That email and password don't match. Try again, or reset your password."),
  ).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);

  // The same address makes a new account, which is a new person's, not the old one come back.
  await signUp(page, email);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toHaveCount(1); // BROKEN ON PURPOSE
});

test("the daily job does not finish an account whose 14 days are not over", async ({ page }) => {
  const email = `journey+waiting-${crypto.randomUUID().slice(0, 12)}@ruken.test`;
  await askToBeDeleted(page, email);

  await runTheDailyJob(page);

  // Still within the 14 days, so signing in still undoes it.
  await page.goto("/sign-in?next=%2Fme");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/me");
  await expect(page.getByText("Welcome back. Your account will not be deleted.")).toBeVisible();
});
