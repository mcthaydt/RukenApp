import { expect, test, type Page } from "@playwright/test";
import {
  fillBirthDate,
  freshEmail,
  JOURNEY_PASSWORD,
  payAsNewMember,
  signUpInItsOwnContext,
  yearsAgo,
} from "./support/account.ts";
import { arrivalCookie, membershipStartsOf, userIdOf } from "./support/database.ts";
import { rgb, token } from "../support/look-tokens.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

/** Signs up through the card, as a stranger who has not signed in yet, and lands back on it as a person who can pay. */
async function signUpFromTheCard(page: Page): Promise<string> {
  const email = freshEmail();
  await page.goto("/join?next=/me");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("button", { name: "Continue to payment" })).toBeVisible();
  return email;
}

test("a stranger signs up, pays, and lands where they were going as a member", async ({ page }) => {
  await signUpFromTheCard(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page).toHaveURL("/me");
});

test("someone else's checkout ref goes back to the card", async ({ page }) => {
  await signUpFromTheCard(page);
  await page.goto(`/join/done?checkout=${crypto.randomUUID()}`);
  await expect(page).toHaveURL(/\/join/);
  await page.goto("/join/done");
  await expect(page).toHaveURL(/\/join/);
});

test("when Stripe's news is late, the page says so and goes on by itself", async ({ page }) => {
  await signUpFromTheCard(page);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  // The stand-in's own page, asked to send its news three seconds after it sends the browser back.
  await page.goto(`${page.url()}?events=later`);
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.getByRole("heading", { name: "Finishing up…" })).toBeVisible();
  // Looked at right away, and with values only: the page moves on to /me by itself (design 5.8). Both wait.
  await expect(page.locator("main.card")).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "32px");
  await expect(page).toHaveURL("/me"); // waits on the page, not a sleep
});

// Design 8: a member's sign-up records the maker's link they came through. No screen shows it, so the row is read.
test("a member's sign-up records the maker's link they came through", async ({ page, browser }) => {
  const maker = await signUpInItsOwnContext(browser);
  const makerUserId = await userIdOf(maker.email);
  await page.context().addCookies([arrivalCookie({ makerUserId, path: "/g/a-game" })]);

  const member = await payAsNewMember(page);

  expect(await membershipStartsOf(member.email)).toMatchObject([
    { broughtByUserId: makerUserId, arrivalPath: "/g/a-game" },
  ]);
});

test("a member who came through no maker's link has no maker recorded", async ({ page }) => {
  const member = await payAsNewMember(page);

  expect(await membershipStartsOf(member.email)).toMatchObject([
    { broughtByUserId: null, arrivalPath: null },
  ]);
});
