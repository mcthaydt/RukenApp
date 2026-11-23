import { expect, test } from "@playwright/test";
import { showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Anyone can read how the feed picks games, without an account: what it does today, kept apart from what is coming,
// found from help, from the privacy page and from the terms. The page names rules, never a number the order is tuned
// with, so the feed can't be gamed from it.

test.beforeEach(forgetRateLimits);

const PAGE = "/help/how-the-feed-works";
const BASE = "Ruken - The Everyday Console";

test("a person finds how the feed works from help, reads today apart from what's coming, and goes back", async ({
  page,
}, testInfo) => {
  await page.goto("/help");
  const fromHelp = page.getByRole("link", { name: "How the feed works" });
  await expect(fromHelp).toHaveCSS("text-decoration-line", "none");
  await fromHelp.click();

  await expect(page).toHaveURL(`${PAGE}?from=%2Fhelp`);
  await expect(page.getByRole("heading", { level: 1, name: "How the feed works" })).toBeVisible();
  // The page leaves the tab's name to the layout, like every screen that is not a game.
  await expect(page).toHaveTitle(BASE);

  const today = page.getByRole("region", { name: "How it works today" });
  await expect(today).toContainText("Everyone sees the same feed.");
  await expect(today).toContainText("A maker playing their own game adds nothing.");
  await expect(today).toContainText("The feed never ends.");
  const coming = page.getByRole("region", { name: "Coming soon" });
  await expect(coming).toContainText("Your feed doesn't learn from what you do until a parent says yes.");
  await expect(coming).toContainText('until you press "I agree"');
  const never = page.getByRole("region", { name: "What we never do" });
  await expect(never).toContainText("Nobody can pay to move a game up the feed.");
  await showTheOwner(page, testInfo, "how the feed works");

  // No number the order is tuned with: past the date at the top, the only figure is the age, 18.
  const words = (await Promise.all([today, coming, never].map((part) => part.innerText()))).join("\n");
  expect(words.match(/\d+/g) ?? []).toEqual(["18"]);

  // No link on the page is underlined (the owner, 2026-11-22: "no text with underline links anywhere").
  for (const link of await page.getByRole("main").getByRole("link").all()) {
    await expect(link).toHaveCSS("text-decoration-line", "none");
  }

  await page.getByRole("link", { name: "Back to help" }).first().click();
  await expect(page).toHaveURL("/help");
});

test("the privacy page and the terms each lead to how the feed works, and the keyboard alone gets there", async ({
  page,
}) => {
  await page.goto("/privacy");
  const fromPrivacy = page.getByRole("link", { name: "How the feed works" });
  await fromPrivacy.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(PAGE);
  await expect(page.getByRole("heading", { level: 1, name: "How the feed works" })).toBeVisible();

  await page.getByRole("link", { name: "Read the terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await page.getByRole("link", { name: "How the feed works" }).click();
  await expect(page).toHaveURL(PAGE);

  await page.getByRole("link", { name: "Read what we keep about you" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();

  // Opened from outside help, the way back is Ruken's front page.
  await page.goto(PAGE);
  await page.getByRole("link", { name: "Back to Ruken" }).first().click();
  await expect(page).toHaveURL("/");
});
