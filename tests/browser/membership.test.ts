import { expect, test } from "@playwright/test";
import { payAsNewMember, signUp, subscriptionStatusAtStandIn } from "./support/account.ts";
import { boxOf, expectOneCard, showTheOwner } from "./support/look.ts";
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
  // One card, one filled button (Change card or cancel), nothing red: the membership action is the card's one main one.
  await expectOneCard(page);
  // The Owner, 2026-11-14, "All six": the button says what it does, and the line under it says where it goes.
  await expect(page.getByRole("button", { name: "Change card or cancel" })).toBeVisible();
  await expect(page.getByText("Opens our payment page, run by Stripe.")).toBeVisible();
  await expect(page.getByText("Manage or cancel")).toHaveCount(0);
  await expect(page.getByText(/Opens Stripe/)).toHaveCount(0);
  await showTheOwner(page, testInfo, "your account, as a member");
});

// Design 8: "A member can cancel."
test("a member cancels on Stripe and is told when it ends", async ({ page }) => {
  await payAsNewMember(page);
  await page.getByRole("button", { name: "Change card or cancel" }).click();
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
  await expect(page.getByRole("heading", { name: "Your account will be deleted." })).toBeVisible();
  expect(await subscriptionStatusAtStandIn(member)).toBe("canceled");
});

// The Owner, 2026-11-14, "All six": the no-refund line comes before "Changed your mind?", and someone who only wants to
// stop paying is offered the cancel page they would get from /me.
test("a paying member's delete screen says the no-refund line first, and offers cancelling instead", async ({
  page,
}, testInfo) => {
  await payAsNewMember(page);
  await page.goto("/me/delete");
  await expectOneCard(page);
  const first = await boxOf(
    page.getByText("We'll sign you out everywhere now, and delete your account in 14 days."),
  );
  const noRefund = await boxOf(
    page.getByText(
      "Your membership ends now. There is no refund for the time left, and signing in again does not bring it back.",
    ),
  );
  const changedMind = await boxOf(
    page.getByText("Changed your mind? Sign in before then and nothing is deleted."),
  );
  expect(noRefund.y).toBeGreaterThan(first.y);
  expect(changedMind.y).toBeGreaterThan(noRefund.y);
  await showTheOwner(page, testInfo, "delete your account, as a paying member");

  // It is a button that looks like a link: opening Stripe's page is a post, which a link cannot make.
  await page
    .getByRole("button", { name: "Only want to stop paying? Cancel your membership instead." })
    .click();
  await page.getByRole("button", { name: "Cancel membership" }).click();
  await expect(page).toHaveURL("/me");
  await expect(
    page.getByText(/^Your membership ends on \w+, \w+ \d+\. You can play until then\.$/),
  ).toBeVisible();
});

test("someone who is not a member is not told their membership ends", async ({ page }) => {
  await signUp(page);
  await page.goto("/me/delete");
  await expect(page.getByRole("heading", { name: "Delete your account?" })).toBeVisible();
  await expect(page.getByText(/Your membership ends now/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Only want to stop paying/ })).toHaveCount(0);
});

test("a member who opens the card is told they are one", async ({ page }) => {
  await payAsNewMember(page);
  await page.goto("/join?next=/me");
  await expect(page.getByRole("heading", { name: "You're already a member." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Keep playing" })).toHaveAttribute("href", "/me");
  await expect(page.getByRole("button")).toHaveCount(0);
});
