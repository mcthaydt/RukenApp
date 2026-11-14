import { expect, test } from "@playwright/test";
import { rgb, token } from "../support/look-tokens.ts";
import { fillBirthDate, freshEmail, JOURNEY_PASSWORD, signUp, yearsAgo } from "./support/account.ts";
import { boxOf, pipRed, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

test.beforeEach(forgetRateLimits);

const RENEWS = "Renews until you cancel. You can cancel any time from your account.";

// The Owner, 2026-11-14, "All six" (a design review of the newest screens).
test("the card says the price, that it renews, and what happens next", async ({ page }) => {
  await page.goto("/join");
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  // The prices are in the two rows, once each; the line above them says only about tax (the Owner, "All six").
  await expect(page.getByText("Tax is added where it applies.", { exact: true })).toBeVisible();
  await expect(page.getByText("$9.99 a month")).toHaveCount(1);
  await expect(page.getByText("$99 a year")).toHaveCount(1);
  await expect(page.getByText(RENEWS)).toBeVisible();
  // Signed out, the next page is sign-up, so the card says the two steps in their order.
  await expect(
    page.getByText("First you make an account, then you pay. Then you come straight back."),
  ).toBeVisible();
  await expect(page.getByText("You pay on the next page")).toHaveCount(0);
  await expect(page.getByRole("button")).toHaveCount(1);
});

test("signed in, the card says the renewal and that the next page is payment", async ({ page }) => {
  await signUp(page);
  await page.goto("/join");
  await expect(page.getByText(RENEWS)).toBeVisible();
  await expect(page.getByText("You pay on the next page, then come straight back.")).toBeVisible();
  await expect(page.getByText("First you make an account")).toHaveCount(0);
});

test("the two plans are full-width rows of real radio buttons, each with its price once", async ({
  page,
}) => {
  await page.goto("/join");
  const monthly = page.getByRole("radio", { name: "$9.99 a month", exact: true });
  const annual = page.getByRole("radio", { name: "$99 a year", exact: true });
  // The card opens on the monthly price, and the other is one tap away.
  await expect(monthly).toBeChecked();
  await expect(annual).not.toBeChecked();
  await expect(page.getByText(/Monthly|Yearly/)).toHaveCount(0);

  const card = await boxOf(page.locator("main.card"));
  const monthlyRow = await boxOf(page.locator("label", { has: monthly }));
  const annualRow = await boxOf(page.locator("label", { has: annual }));
  for (const row of [monthlyRow, annualRow]) {
    // As wide as the card's inside (its padding is at most 2rem a side) and as tall as a button.
    expect(row.width).toBeGreaterThanOrEqual(card.width - 2 * 32 - 1);
    expect(row.height).toBeGreaterThanOrEqual(48);
  }
  expect(annualRow.x).toBeCloseTo(monthlyRow.x, 0);
  expect(annualRow.width).toBeCloseTo(monthlyRow.width, 0);
  expect(annualRow.y).toBeGreaterThanOrEqual(monthlyRow.y + monthlyRow.height);
});

test("pressing anywhere on a plan's row picks it", async ({ page }) => {
  await page.goto("/join");
  const annualRow = page.locator("label", { has: page.getByRole("radio", { name: "$99 a year" }) });
  const box = await boxOf(annualRow);
  // The far end of the row, well away from the little circle and the words.
  await annualRow.click({ position: { x: box.width - 6, y: box.height / 2 } });
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "$9.99 a month" })).not.toBeChecked();
});

// A journey failed once in CI (slice 2's run 222, computer): the yearly plan was lost on the way to sign-up. The card set
// each radio button from the plan in the address, and when the page came alive that put the monthly plan back over a
// choice made a moment before. A person on a slow phone can do the same. This holds the page's scripts back, picks the
// plan on the page as the server sent it, lets the scripts run, and checks the choice is still there and still sent.
test("a plan picked before the page has come alive is kept when it does", async ({ page }) => {
  let release: () => void = () => undefined;
  const scriptsMayRun = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.m?js(\?.*)?$/, async (route) => {
    await scriptsMayRun;
    await route.continue();
  });
  // The scripts are held, so the page never finishes loading: the server's page is all there is to wait for.
  await page.goto("/join?next=/me", { waitUntil: "commit" });
  await page.getByRole("radio", { name: "$99 a year" }).check();
  release();
  // Every script has arrived and run once the network has been quiet.
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "$9.99 a month" })).not.toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=.*plan%3Dannual/);
});

test("a signed-out person is asked to sign up only after pressing Continue, and keeps their plan", async ({
  page,
}) => {
  await page.goto("/join?next=/me");
  await page.getByRole("radio", { name: "$99 a year" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-up\?next=/);

  await page.getByLabel("Email").fill(freshEmail());
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the same card, with the plan still chosen, and now the button that spends money.
  await expect(page).toHaveURL(/\/join\?/);
  await expect(page.getByRole("radio", { name: "$99 a year" })).toBeChecked();
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
