import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled } from "./support/account.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// A tab left open gets the newer version of Ruken once one is out (the owner, 2026-11-28: "It's not live", about
// Reposted, on a phone tab still running a version from before it). The journey makes a newer version "out" by
// answering the browser's version check with another version, and marks the open page, so a page loaded again has lost
// the mark and one that stayed has kept it.

test.beforeEach(forgetRateLimits);

/** Answers every version check from here on with a version this build is not. */
async function newerVersionOut(page: Page): Promise<void> {
  await page.route("**/_app/version.json", (route) =>
    route.fulfill({ json: { version: "a-newer-version" } }),
  );
}

async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await pageHasSettled(page);
  await page.evaluate(() => {
    (window as unknown as { openedBefore: boolean }).openedBefore = true;
  });
}

const stillOpen = (page: Page) =>
  page.evaluate(() => (window as unknown as { openedBefore?: boolean }).openedBefore === true);

/** Puts the tab back into view, as switching back to the browser on a phone does. */
async function comeBackToTheTab(page: Page): Promise<void> {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
}

/** Waits for the page to say its check for a newer version is done and it stays as it is. */
async function stayed(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-version-checked", "true");
}

test("coming back to the feed with a newer version out loads it", async ({ page }) => {
  await open(page, "/");
  await newerVersionOut(page);
  const loaded = page.waitForEvent("load");
  await comeBackToTheTab(page);
  await loaded;
  await pageHasSettled(page);
  expect(await stillOpen(page)).toBe(false);
  await expect(page).toHaveURL("/");
});

test("on another screen the newer version waits for the next move, which loads it", async ({ page }) => {
  await open(page, "/search");
  await newerVersionOut(page);
  await comeBackToTheTab(page);
  // Nothing on the screen is taken away from the person: it stays the page they opened.
  await stayed(page);
  expect(await stillOpen(page)).toBe(true);

  await page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "You" }).click();
  await expect(page).toHaveURL(/\/(me|sign-in)/);
  await pageHasSettled(page);
  expect(await stillOpen(page)).toBe(false);
});

test("with no newer version out, coming back and moving stay in the open page", async ({ page }) => {
  await open(page, "/search");
  await comeBackToTheTab(page);
  await stayed(page);
  await page.getByRole("navigation", { name: "Ruken" }).getByRole("link", { name: "You" }).click();
  await expect(page).toHaveURL(/\/(me|sign-in)/);
  await pageHasSettled(page);
  expect(await stillOpen(page)).toBe(true);
});
