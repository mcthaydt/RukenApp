import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  JOURNEY_PASSWORD,
  nationalOf,
  pageHasSettled,
  signInAs,
  signUp,
  SITE_ANSWER_TIMEOUT,
} from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// A signed-in person changes their password from /me. Read: /me shows the number. Update: the one screen. (Create is
// sign-up and delete is "Delete my account"; their own journeys cover them. There is no "change email": nobody signs
// in with an email.)

const NEW_PASSWORD = "a different long password";
const WRONG_PASSWORD_WORDS = "That isn't your password. Try again.";
const SITE_URL = "http://localhost:4173";

/** Tries the sign-in form and answers whether it let the person in. */
async function signInWorks(page: Page, number: string, password: string): Promise<boolean> {
  await page.goto("/sign-in");
  await page.getByLabel("Phone number").fill(nationalOf(number));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  const refused = page.getByText("That number and password don't match.");
  await expect
    .poll(async () => new URL(page.url()).pathname === "/" || (await refused.isVisible()))
    .toBe(true);
  return new URL(page.url()).pathname === "/";
}

/** A browser of its own with nobody signed in: another device. */
async function anotherDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: SITE_URL });
  return context.newPage();
}

test("a person changes their password: other devices are signed out", async ({ page, browser }) => {
  const { number, password } = await signUp(page);
  const other = await anotherDevice(browser);
  await signInAs(other, number, password);

  await page.goto("/me");
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
  await page.getByLabel("Your password now").fill(password);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByText("Done. Your password is changed.")).toBeVisible();
  await pageHasSettled(page);

  // This device stays in; the other one is out.
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await other.goto("/me");
  await expect(other).toHaveURL(/\/sign-in/);

  await page.context().clearCookies();
  expect(await signInWorks(page, number, JOURNEY_PASSWORD)).toBe(false);
  expect(await signInWorks(page, number, NEW_PASSWORD)).toBe(true);
  await other.context().close();
});

test("a wrong current password is refused beside the field, and nothing changes", async ({ page }) => {
  const { number } = await signUp(page);

  await page.goto("/me/password");
  await page.getByLabel("Your password now").fill("not the right password");
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByText(WRONG_PASSWORD_WORDS)).toBeVisible();

  // Nothing changed: the old password still signs in.
  await page.context().clearCookies();
  expect(await signInWorks(page, number, JOURNEY_PASSWORD)).toBe(true);
});

test("a signed-out person is sent to sign in from the screen", async ({ page }) => {
  await page.goto("/me/password");
  await expect(page).toHaveURL("/sign-in?next=%2Fme%2Fpassword");
});

test("the old email screen is gone", async ({ page }) => {
  await signUp(page);
  expect((await page.goto("/me/email"))?.status()).toBe(404);
});

test("everything on the screen works with the keyboard alone, and focus shows", async ({ page }) => {
  const { password } = await signUp(page);
  await page.goto("/me");

  // Tab from the top of /me to the link, check its focus ring shows, and press Enter on it.
  const link = page.getByRole("link", { name: "Change password" });
  // A bounded walk: the link is a few presses from the top, and the journey fails if it is never reached.
  for (
    let presses = 0;
    presses < 12 && !(await link.evaluate((el) => el === document.activeElement));
    presses += 1
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", /solid|auto/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();

  // Fill the fields, Tab to the button, and press Enter on it.
  await page.getByLabel("Your password now").fill(password);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.keyboard.press("Tab");
  const save = page.getByRole("button", { name: "Save password" });
  await expect(save).toBeFocused();
  await expect(save).toHaveCSS("outline-style", /solid|auto/);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Done. Your password is changed.")).toBeVisible();
});
