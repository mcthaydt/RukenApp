import { expect, test, type Page } from "@playwright/test";
import { JOURNEY_PASSWORD, signUp } from "./support/account.ts";
import { linkIn, mailTo } from "./support/mail.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// What a person does with the mail Ruken sends: open its link. The mail is read from the stand-in mail service
// (tests/browser/support/fake-mail-server.ts), so each journey opens the very link the site mailed.

test.beforeEach(forgetRateLimits);

const CONFIRM_SUBJECT = "Confirm your email for Ruken";
const RESET_SUBJECT = "Reset your Ruken password";
const CHANGED_SUBJECT = "Your Ruken password was changed";
const NEW_PASSWORD = "a different long password";

test("a new person opens the link in the mail and their email is confirmed", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/me");
  await expect(page.getByText("Confirm your email.")).toBeVisible();

  await page.goto(linkIn(await mailTo(email, CONFIRM_SUBJECT)));

  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText("Confirm your email.")).toHaveCount(1); // BROKEN ON PURPOSE
});

test("a link asked for again confirms the email too, and lands on the person's page", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/me");
  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByText("Sent. Check your email.")).toBeVisible();

  // The link in the second mail is the one asked for from /me, which sends the person back to /me.
  await expect
    .poll(async () => linkIn(await mailTo(email, CONFIRM_SUBJECT)), {
      message: "waiting for the second mail",
    })
    .toMatch(/callbackURL=(%2F|\/)me/);
  await page.goto(linkIn(await mailTo(email, CONFIRM_SUBJECT)));

  await expect(page).toHaveURL("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText("Confirm your email.")).toHaveCount(0);
});

/** An account with its person signed out, as someone who forgot their password is. */
async function signedOutWithAccount(page: Page): Promise<string> {
  const { email } = await signUp(page);
  await page.context().clearCookies();
  return email;
}

async function askForTheResetLink(page: Page, email: string): Promise<string> {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send the link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  return linkIn(await mailTo(email, RESET_SUBJECT));
}

test("a person who forgot their password opens the mailed link, saves a new one, and signs in with it", async ({
  page,
}) => {
  const email = await signedOutWithAccount(page);
  const link = await askForTheResetLink(page, email);

  await page.goto(link);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByLabel("Type it again").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL("/sign-in?reset=1");
  await expect(page.getByText("Your password is updated. Sign in with it.")).toBeVisible();
  // They are told it changed, in case it was not them.
  await mailTo(email, CHANGED_SUBJECT);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("after the reset, the old password no longer signs in, and the link cannot be used twice", async ({
  page,
}) => {
  const email = await signedOutWithAccount(page);
  const link = await askForTheResetLink(page, email);
  await page.goto(link);
  await page.getByLabel("New password").fill(NEW_PASSWORD);
  await page.getByLabel("Type it again").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page).toHaveURL("/sign-in?reset=1");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That email and password don't match. Try again, or reset your password."),
  ).toBeVisible();

  await page.goto(link);
  await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a new link" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
});
