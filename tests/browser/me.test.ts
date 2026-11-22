import { expect, test } from "@playwright/test";
import { shownAs } from "../../src/features/accounts/phone.ts";
import { signUp } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

test("a signed-out person is sent to sign in, and comes back", async ({ page }) => {
  await page.goto("/me");
  await expect(page).toHaveURL("/sign-in?next=%2Fme");
});

test("the page shows the person's number and signs them out", async ({ page }) => {
  const { number } = await signUp(page);
  await page.goto("/me");
  await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  await expect(page.getByText(shownAs(number)).first()).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/me");
  await expect(page).toHaveURL(/\/sign-in/);
});
