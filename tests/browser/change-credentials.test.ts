import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  JOURNEY_PASSWORD,
  freshEmail,
  pageHasSettled,
  payAsNewMember,
  signInAs,
  signUp,
  SITE_ANSWER_TIMEOUT,
} from "./support/account.ts";
import { countMailsTo, linkIn, mailTo } from "./support/mail.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// A signed-in person changes their email and their password from /me. Read: /me shows the address. Update: the two
// screens. (Create is sign-up and delete is "Delete my account"; their own journeys cover them.)

const NEW_PASSWORD = "a different long password";
const LINK_SUBJECT = "Confirm your new email for Ruken";
const NOTICE_SUBJECT = "A new email was asked for on your Ruken account";
const WRONG_PASSWORD_WORDS = "That isn't your password. Try again.";
const SITE_URL = "http://localhost:4173";

/** Tries the sign-in form and answers whether it let the person in. */
async function signInWorks(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  const refused = page.getByText("That email and password don't match.");
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

test("a person changes their email: nothing changes until the mailed link is opened", async ({
  page,
  browser,
}) => {
  const { email, password } = await signUp(page);
  const newEmail = freshEmail();

  await page.goto("/me");
  await page.getByRole("link", { name: "Change email" }).click();
  await expect(page.getByRole("heading", { name: "Change your email" })).toBeVisible();
  await page.getByLabel("New email").fill(newEmail);
  await page.getByLabel("Your password").fill(password);
  await page.getByRole("button", { name: "Send the link" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByText(`We sent a link to ${newEmail}. Open it to finish.`)).toBeVisible();
  // A person who is not a member is not told about receipts.
  await expect(page.getByText("payment receipts")).toHaveCount(0);

  // Before the link: the old address stays, and the old address was told.
  await page.goto("/me");
  await expect(page.getByText(email).first()).toBeVisible();
  await mailTo(email, NOTICE_SUBJECT);
  const other = await anotherDevice(browser);
  expect(await signInWorks(other, newEmail, password)).toBe(false);
  expect(await signInWorks(other, email, password)).toBe(true);
  await other.context().close();

  // The link finishes it.
  await page.goto(linkIn(await mailTo(newEmail, LINK_SUBJECT)));
  await page.goto("/me");
  await expect(page.getByText(newEmail).first()).toBeVisible();
  await page.context().clearCookies();
  expect(await signInWorks(page, newEmail, password)).toBe(true);
  await page.context().clearCookies();
  expect(await signInWorks(page, email, password)).toBe(false);
});

test("a person changes their password: other devices are signed out", async ({ page, browser }) => {
  const { email, password } = await signUp(page);
  const other = await anotherDevice(browser);
  await signInAs(other, { email, password });

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
  expect(await signInWorks(page, email, JOURNEY_PASSWORD)).toBe(false);
  expect(await signInWorks(page, email, NEW_PASSWORD)).toBe(true);
  await other.context().close();
});

test("a wrong current password is refused beside the field on both screens, and nothing is mailed", async ({
  page,
}) => {
  const { email } = await signUp(page);
  const newEmail = freshEmail();

  await page.goto("/me/email");
  await page.getByLabel("New email").fill(newEmail);
  await page.getByLabel("Your password").fill("not the right password");
  await page.getByRole("button", { name: "Send the link" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByText(WRONG_PASSWORD_WORDS)).toBeVisible();
  // What was typed stays; the password does not.
  await expect(page.getByLabel("New email")).toHaveValue(newEmail);
  await expect(page.getByLabel("Your password")).toHaveValue("");

  await page.goto("/me/password");
  await page.getByLabel("Your password now").fill("not the right password");
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click({ timeout: SITE_ANSWER_TIMEOUT });
  await expect(page.getByText(WRONG_PASSWORD_WORDS)).toBeVisible();

  expect(await countMailsTo(newEmail, LINK_SUBJECT)).toBe(0);
  expect(await countMailsTo(email, NOTICE_SUBJECT)).toBe(0);
  // Nothing changed: the old password still signs in.
  await page.context().clearCookies();
  expect(await signInWorks(page, email, JOURNEY_PASSWORD)).toBe(true);
});

test("a signed-out person is sent to sign in from both screens", async ({ page }) => {
  await page.goto("/me/email");
  await expect(page).toHaveURL("/sign-in?next=%2Fme%2Femail");
  await page.goto("/me/password");
  await expect(page).toHaveURL("/sign-in?next=%2Fme%2Fpassword");
});

test("a member is told their payment receipts still go to the old address", async ({ page }) => {
  const { email } = await payAsNewMember(page);
  await page.goto("/me/email");
  await expect(page.getByText(`Your payment receipts will still go to ${email} for now.`)).toBeVisible();
});

test("a person who is not a member is not told about receipts", async ({ page }) => {
  await signUp(page);
  await page.goto("/me/email");
  await expect(page.getByRole("heading", { name: "Change your email" })).toBeVisible();
  await expect(page.getByText("payment receipts")).toHaveCount(0);
});

test("everything on both screens works with the keyboard alone, and focus shows", async ({ page }) => {
  const { password } = await signUp(page);
  await page.goto("/me");

  // Tab to each of the two links on /me and press Enter on it.
  for (const [name, heading] of [
    ["Change email", "Change your email"],
    ["Change password", "Change your password"],
  ] as const) {
    await page.goto("/me");
    const link = page.getByRole("link", { name });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }

  // On the password screen: fill the fields, Tab to the button, and press Enter on it.
  await page.getByLabel("Your password now").fill(password);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.keyboard.press("Tab");
  const save = page.getByRole("button", { name: "Save password" });
  await expect(save).toBeFocused();
  await expect(save).toHaveCSS("outline-style", /solid|auto/);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Done. Your password is changed.")).toBeVisible();

  // The same on the email screen.
  await page.goto("/me/email");
  await page.getByLabel("New email").fill(freshEmail());
  await page.getByLabel("Your password").fill(NEW_PASSWORD);
  await page.keyboard.press("Tab");
  const send = page.getByRole("button", { name: "Send the link" });
  await expect(send).toBeFocused();
  await expect(send).toHaveCSS("outline-style", /solid|auto/);
  await page.keyboard.press("Enter");
  await expect(page.getByText(/^We sent a link to .+ Open it to finish\.$/)).toBeVisible();
});
