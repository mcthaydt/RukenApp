import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  continueToPayment,
  fillBirthDate,
  freshEmail,
  JOURNEY_PASSWORD,
  payAsNewMember,
  releaseLateNews,
  standInPayButton,
  yearsAgo,
} from "./support/account.ts";
import { membershipStartsOf, userIdOf } from "./support/database.ts";
import { makerWithGameWhere } from "./support/game.ts";
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
  await standInPayButton(page).click();
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
  const checkoutSessionId = await continueToPayment(page);
  // The stand-in's own page, asked to hold its news back until this journey lets it go.
  await page.goto(`${page.url()}?events=later`);
  await standInPayButton(page).click();
  await expect(page.getByRole("heading", { name: "Finishing up…" })).toBeVisible();
  // Looked at while the news is still held, and with values only: the page moves on to /me by itself once it
  // arrives (design 5.8).
  await expect(page.locator("main.card")).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "32px");
  await releaseLateNews(checkoutSessionId);
  await expect(page).toHaveURL("/me"); // waits on the page, not a sleep
});

/** A live game whose maker is a real account, written into the database: the journeys here only open its page. */
async function liveGameOfItsOwnMaker(browser: Browser): Promise<{ slug: string; makerUserId: string }> {
  const game = await makerWithGameWhere(browser, { state: "live" });
  await game.close();
  return { slug: game.slug, makerUserId: await userIdOf(game.makerEmail) };
}

/** A stranger opens a game's page, presses Play, signs up from the price card and pays. */
async function joinFromAGame(page: Page, slug: string): Promise<string> {
  await page.goto(`/g/${slug}`);
  await page.getByRole("link", { name: "Play" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const email = freshEmail();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(JOURNEY_PASSWORD);
  await fillBirthDate(page, yearsAgo(30));
  await page.getByRole("button", { name: "Create account" }).click();
  await continueToPayment(page);
  await standInPayButton(page).click();
  await expect(page).toHaveURL(`/g/${slug}/play`);
  return email;
}

// Design 8: a member's sign-up records the maker's link they came through. No screen shows it, so the row is read.
test("a member's sign-up records the maker's link they came through", async ({ page, browser }) => {
  const game = await liveGameOfItsOwnMaker(browser);
  const email = await joinFromAGame(page, game.slug);
  expect(await membershipStartsOf(email)).toMatchObject([
    { broughtByUserId: game.makerUserId, arrivalPath: `/g/${game.slug}` },
  ]);
});

test("the last maker's link a visitor landed on is the one recorded", async ({ page, browser }) => {
  const first = await liveGameOfItsOwnMaker(browser);
  const last = await liveGameOfItsOwnMaker(browser);
  await page.goto(`/g/${first.slug}`);
  const email = await joinFromAGame(page, last.slug);
  expect(await membershipStartsOf(email)).toMatchObject([
    { broughtByUserId: last.makerUserId, arrivalPath: `/g/${last.slug}` },
  ]);
});

test("a member who came through no maker's link has no maker recorded", async ({ page }) => {
  const member = await payAsNewMember(page);

  expect(await membershipStartsOf(member.email)).toMatchObject([
    { broughtByUserId: null, arrivalPath: null },
  ]);
});
