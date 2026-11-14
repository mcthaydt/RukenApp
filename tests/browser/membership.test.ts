import { expect, test } from "@playwright/test";
import { payAsNewMember, signUp, subscriptionStatusAtStandIn } from "./support/account.ts";
import { expectOneCard, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

test("someone who has not paid is told so and offered the card", async ({ page }) => {
  await signUp(page);
  await page.goto("/me");
  await expect(page.getByText("You're not a member.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Join Ruken" })).toHaveAttribute("href", "/join?next=/me");
});

test("a member sees what they pay and when it renews", async ({ page }, testInfo) => {
  await payAsNewMember(page);
  await expect(
    page.getByText(/^You're a member\. \$9\.99 a month\. Renews on \w+, \w+ \d+\.$/),
  ).toBeVisible();
  // One card, one filled button (Manage or cancel), nothing red: the membership action is the card's one main one.
  await expectOneCard(page);
  await showTheOwner(page, testInfo, "your account, as a member");
});

// Design 8: "A member can cancel."
test("a member cancels on Stripe and is told when it ends", async ({ page }) => {
  await payAsNewMember(page);
  await page.getByRole("button", { name: "Manage or cancel" }).click();
  // The stand-in's billing portal: one button.
  await page.getByRole("button", { name: "Cancel membership" }).click();
  await expect(page).toHaveURL("/me");
  await expect(
    page.getByText(/^Your membership ends on \w+, \w+ \d+\. You can play until then\.$/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Manage" })).toBeVisible();
});

// Review Focus 6.
test("a member who deletes their account is told the membership ends now", async ({ page }) => {
  const member = await payAsNewMember(page);
  await page.goto("/me/delete");
  await expect(
    page.getByText(
      "Your membership ends now. There is no refund for the time left, and signing in again does not bring it back.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByRole("heading", { name: "You're signed out." })).toBeVisible();
  expect(await subscriptionStatusAtStandIn(member)).toBe("canceled");
});

test("someone who is not a member is not told their membership ends", async ({ page }) => {
  await signUp(page);
  await page.goto("/me/delete");
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  await expect(page.getByText(/Your membership ends now/)).toHaveCount(0);
});

test("a member who opens the card is told they are one", async ({ page }) => {
  await payAsNewMember(page);
  await page.goto("/join?next=/me");
  await expect(page.getByRole("heading", { name: "You're already a member." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Keep playing" })).toHaveAttribute("href", "/me");
  await expect(page.getByRole("button")).toHaveCount(0);
});
