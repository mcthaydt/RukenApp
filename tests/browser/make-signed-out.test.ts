import { expect, test, type Page } from "@playwright/test";
import {
  finishSignUpForm,
  freshNumber,
  nationalOf,
  pageHasSettled,
  signUpInItsOwnContext,
} from "./support/account.ts";
import { NOT_CONSENTED } from "./support/consent.ts";
import { boxOf, showTheOwner, wordsHaveSettled } from "./support/look.ts";
import { padReachesEverything, plugInPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The plus in the bar, signed out (the owner, 2026-11-28: "Clicking the plus does nothing when you're signed out, create
// a variant of that page for when you're not signed in"). It opens Your games' own place, which then says what Ruken
// gives a maker, with Join Ruken and Sign in as real buttons that both come back to Your games. It opens before any yes
// to cookies, as the feed's other tabs do, so a first press never lands on the cookie notice. The only thing made here
// is an account, whose create, change and delete are me.test.ts and delete-account.test.ts.

test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });
const plus = (page: Page) => bar(page).getByRole("link", { name: "Add a game", exact: true });

/** From the feed, signed out, a press on the plus lands on the maker's pitch. */
async function pressThePlus(page: Page): Promise<void> {
  await page.goto("/");
  await pageHasSettled(page);
  if (test.info().project.use.hasTouch === true) await plus(page).tap();
  else await plus(page).click();
  await expect(page).toHaveURL("/make");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Made a game? Put it on Ruken.");
}

test.describe("before a yes to cookies", () => {
  test.use({ storageState: NOT_CONSENTED });

  test("the plus opens the maker's pitch, with Join Ruken and Sign in as big buttons", async ({
    page,
  }, testInfo) => {
    await pressThePlus(page);
    await wordsHaveSettled(page);
    await expect(plus(page)).toHaveAttribute("aria-current", "page");
    const join = page.getByRole("main").getByRole("link", { name: "Join Ruken", exact: true });
    const signIn = page.getByRole("main").getByRole("link", { name: "Sign in", exact: true });
    await expect(join).toHaveAttribute("href", "/sign-up?next=%2Fmake");
    await expect(signIn).toHaveAttribute("href", "/sign-in?next=%2Fmake");
    for (const button of [join, signIn]) {
      await expect(button).toBeVisible();
      const box = await boxOf(button);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(box.width).toBeGreaterThanOrEqual(48);
    }
    // Join is the one blue button; Sign in is a quiet one beside it.
    await expect(join).toHaveClass(/\bbutton\b/);
    await expect(signIn).toHaveClass(/\bquiet\b/);
    // Nothing on it for a signed-in maker: no account to go to, no games, no Add a game.
    await expect(page.getByRole("link", { name: "Your account" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add a game", exact: true })).toHaveCount(1);
    await showTheOwner(page, testInfo, "the plus, signed out");
  });

  test("a gamepad reaches every button on it", async ({ page }) => {
    await plugInPad(page);
    await pressThePlus(page);
    await padReachesEverything(page);
  });
});

test("Join Ruken makes the account and comes back to Your games", async ({ page }) => {
  test.setTimeout(120_000);
  await pressThePlus(page);
  await page.getByRole("main").getByRole("link", { name: "Join Ruken", exact: true }).click();
  await expect(page).toHaveURL("/sign-up?next=%2Fmake");
  await finishSignUpForm(page, freshNumber());
  await expect(page).toHaveURL("/make");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your games");
  await expect(page.getByRole("link", { name: "Add a game", exact: true }).last()).toBeVisible();
});

test("Sign in comes back to Your games", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const maker = await signUpInItsOwnContext(browser);
  await pressThePlus(page);
  await page.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/sign-in?next=%2Fmake");
  await page.getByLabel("Phone number").fill(nationalOf(maker.number));
  await page.getByLabel("Password").fill(maker.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/make");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your games");
});
