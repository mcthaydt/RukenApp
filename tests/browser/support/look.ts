import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { rgb, token } from "../../support/look-tokens.ts";

// Helpers for the journeys that check the look (tests/browser/look.test.ts). CI checks values (a colour, a
// size, a font, a request), not taste. A screenshot is attached for a person to look at; nothing compares it.

/**
 * Every card screen that a journey reaches without making an account, and how. Each `open` ends by waiting
 * for the screen's heading, so the checks that follow see the finished page.
 */
export const CARD_SCREENS: { name: string; open(page: Page): Promise<void> }[] = [
  {
    name: "sign up",
    open: async (page) => {
      await page.goto("/sign-up");
      await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    },
  },
  {
    name: "sign in",
    open: async (page) => {
      await page.goto("/sign-in");
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    },
  },
  {
    name: "forgot password",
    open: async (page) => {
      await page.goto("/forgot-password");
      await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    },
  },
  {
    name: "check your email",
    open: async (page) => {
      await page.goto("/forgot-password");
      await page.getByLabel("Email").fill("nobody@ruken.test");
      await page.getByRole("button", { name: "Send the link" }).click();
      await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    },
  },
  {
    name: "new password",
    open: async (page) => {
      await page.goto("/reset-password?token=nope");
      await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    },
  },
  {
    // Signed out, where its one button is the ink "Continue" and nothing on it is red.
    name: "the paywall card",
    open: async (page) => {
      await page.goto("/join");
      await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
    },
  },
  {
    name: "a missing page",
    open: async (page) => {
      await page.goto("/no-such-page");
      await expect(page.getByRole("heading", { name: "We can't find that page." })).toBeVisible();
    },
  },
];

export type Box = { x: number; y: number; width: number; height: number };

/** Where a thing is on the page. Throws, saying so, when it is not there to measure. */
export async function boxOf(thing: Locator): Promise<Box> {
  const box = await thing.boundingBox();
  if (box === null) throw new Error("there is nothing on the page to measure");
  return box;
}

/** The text of every element whose background colour, text colour or any edge colour is the pip red. */
export function pipRed(page: Page): Promise<string[]> {
  const pip = rgb(token("--pip"));
  return page.evaluate((red) => {
    const properties = [
      "backgroundColor",
      "color",
      "borderTopColor",
      "borderRightColor",
      "borderBottomColor",
      "borderLeftColor",
    ] as const;
    return [...document.querySelectorAll("body *")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return properties.some((property) => style[property] === red);
      })
      .map((element) => element.textContent.trim());
  }, pip);
}

/** The filled buttons on a card: every button or link-button that is not the quiet kind. */
export function filledButtons(page: Page): Locator {
  return page.locator(".card button:not(.quiet), .card a.button:not(.quiet)");
}

/**
 * The checks every card screen passes: one paper card, at most one filled button, no red, and nothing that
 * scrolls sideways. A journey that has already made an account checks its screens with this instead of
 * making another account per screen.
 */
export async function expectOneCard(page: Page): Promise<void> {
  const card = page.locator("main.card");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveCSS("background-color", rgb(token("--paper")));
  await expect(card).toHaveCSS("color", rgb(token("--ink")));
  await expect(card).toHaveCSS("border-top-left-radius", "20px");
  await expect(card).toHaveCSS("border-top-width", "0px");
  await expect(card).toHaveCSS("box-shadow", "none");
  await expect(card.getByRole("heading", { level: 1 })).toHaveCSS("font-size", "32px");
  expect(await filledButtons(page).count()).toBeLessThanOrEqual(1);
  expect(await pipRed(page)).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
}

/**
 * Attaches a full-page screenshot to the journey as `look: <screen>`. Playwright runs each journey on a
 * phone and on a computer, so each screen gets both. It compares nothing: it is there for the Owner to look
 * at ("Screenshots on the board", Owner, 2026-11-13).
 */
export async function showTheOwner(page: Page, testInfo: TestInfo, screen: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await testInfo.attach(`look: ${screen}`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}
