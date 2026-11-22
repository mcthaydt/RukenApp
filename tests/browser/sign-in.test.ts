import { expect, test, type Page } from "@playwright/test";
import { freshNumber, JOURNEY_PASSWORD, nationalOf, signUp, SITE_ANSWER_TIMEOUT } from "./support/account.ts";
import { pauseOf } from "./support/database.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { textTo } from "./support/texts.ts";

test.beforeEach(forgetRateLimits);

// A person who has an account but is signed out: the cookies are gone, the account stays.
async function signedOutWithAccount(page: Page): Promise<{ number: string; password: string }> {
  const account = await signUp(page);
  await page.context().clearCookies();
  return account;
}

async function tryPassword(page: Page, number: string, password: string): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
}

test("a person signs in with their number and password", async ({ page }) => {
  const { number, password } = await signedOutWithAccount(page);
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/");
});

test("the number can be typed with brackets, dashes, spaces or a leading 1", async ({ page }) => {
  const { number, password } = await signedOutWithAccount(page);
  const national = nationalOf(number);
  const ways = [
    `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`,
    `${national.slice(0, 3)}.${national.slice(3, 6)}.${national.slice(6)}`,
    `1 ${national}`,
    `+1 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`,
  ];
  for (const typed of ways) {
    await page.goto("/sign-in");
    await page.getByLabel("Phone number").fill(typed);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
    await expect(page, typed).toHaveURL("/");
    await page.context().clearCookies();
  }
});

test("a wrong password says so, keeps the number and offers the reset", async ({ page }) => {
  const { number } = await signedOutWithAccount(page);
  await tryPassword(page, number, "not the right password");
  await expect(
    page.getByText("That number and password don't match. Try again, or reset your password."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByLabel("Phone number")).toHaveValue(nationalOf(number));
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("a number with no account gets the same words as a wrong password", async ({ page }) => {
  await tryPassword(page, freshNumber(), JOURNEY_PASSWORD);
  await expect(
    page.getByText("That number and password don't match. Try again, or reset your password."),
  ).toBeVisible();
});

test("ten wrong passwords pause sign-in for the number, and the right one is held too", async ({ page }) => {
  const { number, password } = await signedOutWithAccount(page);
  for (let guess = 0; guess < 10; guess += 1) {
    await tryPassword(page, number, "not the right password");
    await expect(page.getByText(/don't match|paused|Too many tries/)).toBeVisible();
    // The same address is limited to five a minute (rate-limited first); the journey's address counter is forgotten
    // so the pause is what is under test.
    await forgetRateLimits();
  }
  await expect.poll(async () => (await pauseOf(number))?.pausedUntil ?? null).not.toBeNull();

  await tryPassword(page, number, password);
  await expect(page.getByText(/paused|for an hour/)).toBeVisible();
  // The person is told by text, with the way out.
  const notice = await textTo(number, "Ruken: too many wrong passwords");
  expect(notice.body).toContain("/forgot-password");
  expect(notice.line).toBe("account");
});

test("after a new password is saved, sign-in says so", async ({ page }) => {
  await page.goto("/sign-in?reset=1");
  await expect(page.getByText("Your password is updated. Sign in with it.")).toBeVisible();
});

test("signing in goes on to where the person was going", async ({ page }) => {
  const { number, password } = await signedOutWithAccount(page);
  await page.goto("/sign-in?next=%2Fme");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page).toHaveURL("/me");
});
