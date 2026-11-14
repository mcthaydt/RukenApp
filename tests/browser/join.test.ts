import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { fillBirthDate, freshEmail, JOURNEY_PASSWORD, signUp, yearsAgo } from "./support/account.ts";
import { pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

test("the card says the price and what happens next", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await expect(page.getByText("$9.99 a month, or $99 a year. Tax is added where it applies.")).toBeVisible();
  await expect(page.getByText("You pay on the next page, then come straight back.")).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(1);
  // The card opens on the monthly price, and the other is one tap away.
  await expect(page.getByLabel("Monthly")).toBeChecked();
});

test("a signed-out person is asked to sign up only after pressing Continue, and keeps their plan", async ({
  page,
}) => {
  await page.goto("/join?next=/me");
  await page.getByLabel("Yearly").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);

  await page.getByLabel("Email").fill(freshEmail());
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the same card, with the plan still chosen, and now the button that spends money.
  await expect(page).toHaveURL(/\/join\?/);
  await expect(page.getByLabel("Yearly")).toBeChecked();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
});

test("Continue to payment opens the payment page", async ({ page }) => {
  await signUp(page);
  await page.goto("/join");
  await page.getByRole("button", { name: "Continue to payment" }).click();
  // The stand-in Stripe's page: one button.
  await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();
});

test("next pointing off the site is ignored", async ({ page }) => {
  await page.goto("/join?next=//evil.example");
  await expect(page.getByRole("link", { name: "Not now" })).toHaveAttribute("href", "/");
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
  await page.goto("/join?next=https://evil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/");
});

// Review Focus 16: a second red button, or red anywhere else, fails here before it merges.
test("red is on Continue to payment and nowhere else", async ({ page }, testInfo) => {
  await page.goto("/join");
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(await pipRed(page)).toEqual([]);

  await signUp(page);
  await page.goto("/join");
  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
  expect(await pipRed(page)).toEqual(["Continue to payment"]);
  const pay = page.getByRole("button", { name: "Continue to payment" });
  await expect(pay).toHaveCSS("background-color", rgb(token("--pip")));
  await expect(pay).toHaveCSS("color", rgb(token("--paper")));
  await showTheOwner(page, testInfo, "the paywall card, signed in");
});
