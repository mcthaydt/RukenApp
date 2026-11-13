import { expect, test, type Page } from "@playwright/test";
import { freshEmail, JOURNEY_PASSWORD, signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// A person who has an account but is signed out: the cookies are gone, the account stays.
async function signedOutWithAccount(page: Page): Promise<{ email: string; password: string }> {
  const account = await signUp(page);
  await page.context().clearCookies();
  return account;
}

test("a person signs in with their password", async ({ page }) => {
  const { email, password } = await signedOutWithAccount(page);
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
});

test("a wrong password says so and offers the reset", async ({ page }) => {
  const { email } = await signedOutWithAccount(page);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the right password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("That email and password don't match. Try again, or reset your password."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
  await expect(page.getByLabel("Email")).toHaveValue(email);
});

test("asking for a reset answers the same for any address", async ({ page }) => {
  const email = freshEmail();
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send the link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(
    page.getByText(`If ${email} has an account, we sent a link. It works once, for an hour.`),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/sign-in");
});

test("a made-up reset link offers a new one", async ({ page }) => {
  await page.goto("/reset-password?token=nope");
  await page.getByLabel("New password").fill(JOURNEY_PASSWORD);
  await page.getByLabel("Type it again").fill(JOURNEY_PASSWORD);
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("That link has expired or was already used.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Send a new link" })).toHaveAttribute(
    "href",
    "/forgot-password",
  );
});

test("after a new password is saved, sign-in says so", async ({ page }) => {
  await page.goto("/sign-in?reset=1");
  await expect(page.getByText("Your password is updated. Sign in with it.")).toBeVisible();
});
