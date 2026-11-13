import { expect, test } from "@playwright/test";
import { signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

test("a signed-out person is sent to sign in, and comes back", async ({ page }) => {
  await page.goto("/me");
  await expect(page).toHaveURL("/sign-in?next=%2Fme");
});

test("the page shows the person's email and signs them out", async ({ page }) => {
  const { email } = await signUp(page);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(email).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("an unconfirmed address can ask for the link again", async ({ page }) => {
  await signUp(page);
  await page.goto("/me");
  await expect(page.getByText("Confirm your email.")).toBeVisible();
  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByText("Sent. Check your email.")).toBeVisible();
});
