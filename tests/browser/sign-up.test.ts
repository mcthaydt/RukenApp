import { expect, test } from "@playwright/test";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { fillBirthDate, freshEmail, JOURNEY_PASSWORD, signUp, yearsAgo } from "./support/account.ts";

test.beforeEach(forgetRateLimits);

// Each journey runs on a phone and on a computer, against one shared database, so every account
// uses a fresh address.
async function fillSignUp(
  page: import("@playwright/test").Page,
  fields: { email: string; password: string; age: number },
): Promise<void> {
  await page.getByLabel("Email").fill(fields.email);
  await page.getByLabel("Password").fill(fields.password);
  await fillBirthDate(page, yearsAgo(fields.age));
  await page.getByRole("button", { name: "Create account" }).click();
}

test("a stranger makes an account and lands signed in", async ({ page }) => {
  await page.goto("/sign-up?next=/me");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await fillSignUp(page, { email: freshEmail(), password: JOURNEY_PASSWORD, age: 30 });
  await expect(page).toHaveURL("/me");
});

test("a short password says what to fix and keeps the email", async ({ page }) => {
  const email = freshEmail();
  await page.goto("/sign-up");
  await fillSignUp(page, { email, password: "too short", age: 30 });
  await expect(page.getByText("Use a password of 10 to 128 characters.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await expect(page.getByLabel("Password")).toHaveValue("");
});

test("an address that already has an account is sent to sign in", async ({ page }) => {
  const { email } = await signUp(page);
  await page.context().clearCookies();
  await page.goto("/sign-up");
  await fillSignUp(page, { email, password: JOURNEY_PASSWORD, age: 30 });
  await expect(page.getByText("There's already an account with that email. Sign in instead.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("someone under 13 is told to come back", async ({ page }) => {
  await page.goto("/sign-up");
  await fillSignUp(page, { email: freshEmail(), password: JOURNEY_PASSWORD, age: 12 });
  await expect(page.getByRole("heading", { name: "Ruken isn't for you yet." })).toBeVisible();
  await expect(page.getByText("Come back when you're 13.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to Ruken" })).toHaveAttribute("href", "/");
});

test("next pointing off the site lands on the home page", async ({ page }) => {
  await page.goto("/sign-up?next=https://evil.example");
  await fillSignUp(page, { email: freshEmail(), password: JOURNEY_PASSWORD, age: 30 });
  await expect(page).toHaveURL("/");
});
