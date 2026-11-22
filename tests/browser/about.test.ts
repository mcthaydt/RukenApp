import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { gameWhere } from "./support/game.ts";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";
import { dollars, PREMIUM_PRICES_CENTS } from "../../src/features/membership/membership.ts";
import { BASE_TITLE } from "../../src/lib/titles.ts";

// The landing page (/about): a stranger who wants to know what Ruken is finds it from the price card, the sign-in screen,
// the You page and the help, reads it top to bottom, and goes on to the feed or to the help for makers. It makes nothing
// a person can save, so it has no create, update or delete of its own.

test.beforeEach(forgetRateLimits);

const SECTIONS = [
  "Made a game? Let people play it.",
  "Find your next game in a swipe.",
  "One price. Every game.",
  "How Ruken works",
  "Your clip got seen. Now send them here.",
  "Chosen by people. Safe to play.",
  "Makers' pay, in the open",
  "Want to play?",
  "Made a game?",
];

/** The page is there and says what Ruken is, with its one blue button first. */
async function expectTheLandingPage(page: Page): Promise<void> {
  await expect(page).toHaveURL("/about");
  // Every screen shows the base title in the browser tab (#320).
  await expect(page).toHaveTitle(BASE_TITLE);
  await expect(page.getByRole("heading", { level: 1, name: "Watch a game. Then play it." })).toBeVisible();
}

test("a stranger reads what Ruken is, in order, and goes to the feed", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  // A live game, so the feed has a clip for the top of the page.
  const context = await browser.newContext({ baseURL: "http://localhost:4173" });
  try {
    await gameWhere(await context.newPage(), { state: "live" });
  } finally {
    await context.close();
  }

  await page.goto("/about");
  await expectTheLandingPage(page);
  await pageHasSettled(page);

  // The headings come in the page's order.
  const headings = await page.getByRole("heading", { level: 2 }).allInnerTexts();
  const order = SECTIONS.map((name) => headings.indexOf(name));
  expect(order.every((at) => at >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));

  // The live games' clips are the first screen, as a wall of the feed's own clips.
  await expect(page.locator(".hero .wall video")).toHaveCount(6);
  // The price is the paywall card's, from the rules.
  const monthly = dollars(PREMIUM_PRICES_CENTS.monthly);
  const annual = dollars(PREMIUM_PRICES_CENTS.annual);
  await expect(page.getByText(`${monthly} a month, or ${annual} a year`)).toBeVisible();
  // Signed out, the way to sign in is at the top.
  await expect(
    page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Sign in" }),
  ).toBeVisible();

  // Nothing pushes the page sideways.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // Every link and button is big enough for a thumb.
  const small = await page.locator("main.about a").evaluateAll((links) =>
    links
      .map((link) => ({ words: link.textContent.trim(), box: link.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ words }) => words),
  );
  expect(small).toEqual([]);
  await showTheOwner(page, testInfo, "the landing page");

  // "For makers" jumps to the makers' block.
  await page
    .getByRole("navigation", { name: "On this page" })
    .getByRole("link", { name: "For makers" })
    .click();
  await expect(page).toHaveURL("/about#makers");

  // The keyboard alone reaches the one blue button and presses it.
  const watch = page.getByRole("link", { name: "Watch the feed" }).first();
  await watch.focus();
  await expect(watch).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
});

test("a maker goes from the landing page to the help for makers", async ({ page }) => {
  await page.goto("/about");
  await expectTheLandingPage(page);
  await page.locator("#makers").getByRole("link", { name: "Help for makers" }).click();
  await expect(page).toHaveURL("/help");
  await expect(page.getByRole("heading", { level: 1, name: "Help for makers" })).toBeVisible();

  // And back: the help links to the landing page too.
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
});

test("the landing page's foot leads to the terms and the privacy pages, with no underline", async ({
  page,
}) => {
  for (const name of ["Terms", "Privacy"]) {
    await page.goto("/about");
    await expectTheLandingPage(page);
    const link = page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name, exact: true });
    // No underlined words act as links on Ruken (the owner's rule, 2026-11-22).
    expect(await link.evaluate((node) => getComputedStyle(node).textDecorationLine)).toBe("none");
    await link.click();
    await expect(page).toHaveURL(`/${name.toLowerCase()}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  }
});

test("the price card and the sign-in screen lead to the landing page", async ({ page }) => {
  await page.goto("/join");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
});

test("the You page leads to the landing page, which has no Sign in for someone signed in", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/me");
  await page.getByRole("link", { name: "What is Ruken?" }).click();
  await expectTheLandingPage(page);
  await expect(
    page.getByRole("navigation", { name: "On this page" }).getByRole("link", { name: "Sign in" }),
  ).toHaveCount(0);
});
