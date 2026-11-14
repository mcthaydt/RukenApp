import { expect, test } from "@playwright/test";
import { letMembershipRunOut, payAsNewMember, subscriptionStatusAtStandIn } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

// A member whose membership has ended comes back and joins again (design 5.5). The month runs out at the stand-in
// Stripe, which tells the site, as Stripe does.

test("a member whose membership has ended is offered the card again, pays, and is a member again", async ({
  page,
}) => {
  const first = await payAsNewMember(page);
  await page.getByRole("button", { name: "Change card or cancel" }).click();
  await page.getByRole("button", { name: "Cancel membership" }).click();
  await expect(
    page.getByText(/^Your membership ends on \w+, \w+ \d+\. You can play until then\.$/),
  ).toBeVisible();

  await letMembershipRunOut(first);
  await page.reload();
  await expect(page.getByText("You're a member.")).toBeVisible(); // BROKEN ON PURPOSE
  await expect(page.getByRole("link", { name: "Join Ruken" })).toHaveAttribute("href", "/join?next=/me");

  // The price card is back, with its button, as for someone who never joined.
  await page.getByRole("link", { name: "Join Ruken" }).click();
  await expect(page.getByRole("heading", { name: "You're already a member." })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("button", { name: "Pay" })).toBeVisible();
  const secondCheckout = new URL(page.url()).pathname.split("/").pop() ?? "";
  expect(secondCheckout).not.toBe(first.checkoutSessionId);
  await page.getByRole("button", { name: "Pay" }).click();

  await expect(page).toHaveURL("/me");
  await expect(
    page.getByText(/^You're a member\. \$9\.99 a month\. Renews on \w+, \w+ \d+\.$/),
  ).toBeVisible();
  expect(await subscriptionStatusAtStandIn({ checkoutSessionId: secondCheckout })).toBe("active");
  expect(await subscriptionStatusAtStandIn(first)).toBe("canceled");
});
