import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { CONSENTED_STATE } from "./support/consent.ts";
import { asInstalled } from "./support/installed.ts";
import { boxOf, showTheOwner } from "./support/look.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Inside the app the page never scrolls; it works like an app's one window (the owner, 2026-11-24: "within the app ... it
// functions like a single page app and we shouldn't ever need to scroll, and if we do, it should still be single page
// but it scrolls within the view, but even then that should be rare"). A screen's view ends above the bar, so the bar
// never covers a button (the owner's picture: on Your account the bar covered Delete my account). A phone held sideways
// in a browser tab is asked to turn upright and add Ruken to the Home Screen ("we block horizontal and tell them to save
// it to homepage"); opened from there it works sideways. Nothing here is made or saved, so there is no create, update or
// delete: the journeys that make an account and delete it are me.test.ts and delete-account.test.ts.

test.beforeEach(forgetRateLimits);

const bar = (page: Page) => page.getByRole("navigation", { name: "Ruken" });

/** How far the page itself and the screen's view run past the window: both 0 when the screen fits. */
async function overflow(page: Page): Promise<{ page: number; view: number }> {
  return page.evaluate(() => ({
    page: document.documentElement.scrollHeight - innerHeight,
    view: document.body.scrollHeight - document.body.clientHeight,
  }));
}

/**
 * Every button, link and field the bar covers. The view (the body) is cut off above the bar, so a line runs under it
 * only if the view itself reaches the bar: what is drawn of each line is the part inside the view.
 */
async function underTheBar(page: Page): Promise<string[]> {
  const top = (await boxOf(bar(page))).y;
  return page.evaluate(
    (barTop) =>
      [...document.querySelectorAll("main :is(a, button, input, select, textarea, summary)")]
        .filter((thing) => {
          const box = thing.getBoundingClientRect();
          const view = document.body.getBoundingClientRect();
          const drawnTop = Math.max(box.top, view.top);
          const drawnBottom = Math.min(box.bottom, view.bottom);
          return box.width > 0 && drawnBottom > drawnTop && drawnBottom > barTop;
        })
        .map((thing) => thing.textContent.trim() || (thing.getAttribute("aria-label") ?? "")),
    top,
  );
}

/** The view ends above the bar, so the bar has nothing of the screen under it. */
async function expectViewAboveTheBar(page: Page, path: string): Promise<void> {
  const viewBottom = await page.evaluate(() => document.body.getBoundingClientRect().bottom);
  expect(viewBottom, path).toBeLessThanOrEqual((await boxOf(bar(page))).y);
  expect(await underTheBar(page), path).toEqual([]);
}

async function opened(page: Page, path: string): Promise<void> {
  await page.goto(path);
  // Started, so a press is the app's own move and not a whole new page load.
  await pageHasSettled(page);
  await expect(bar(page)).toBeVisible();
}

test.describe("signed out", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("no screen scrolls the page, the bar covers nothing, and Cookies fits", async ({ page }) => {
    // Sign in, Join and Forgot password are forms taller than a small phone: they scroll inside their view.
    for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/cookies"]) {
      await opened(page, path);
      expect((await overflow(page)).page, path).toBe(0);
      await expectViewAboveTheBar(page, path);
    }
    expect((await overflow(page)).view).toBe(0);
  });
});

test("Your account and Your games fit the window, and the bar covers nothing", async ({ page }, testInfo) => {
  await signUp(page);
  for (const path of ["/me", "/make", "/me/password", "/me/computers", "/me/delete"]) {
    await opened(page, path);
    expect(await overflow(page), path).toEqual({ page: 0, view: 0 });
    await expectViewAboveTheBar(page, path);
  }
  await opened(page, "/me");
  await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();
  await showTheOwner(page, testInfo, "Your account fits the window");

  // The smallest phone still in use (320 by 568): Your account fits with nothing to scroll.
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => (await overflow(page)).view).toBe(0);
  expect((await overflow(page)).page).toBe(0);
  await expectViewAboveTheBar(page, "/me at 320 by 568");
  await expect(page.getByRole("link", { name: "Delete my account" })).toBeInViewport();
});

test.describe("a long screen", () => {
  test.use({ storageState: CONSENTED_STATE });

  test("scrolls inside its view, never the page, and its end clears the bar", async ({ page, isMobile }) => {
    await opened(page, "/privacy");
    expect((await overflow(page)).page).toBe(0);
    expect((await overflow(page)).view).toBeGreaterThan(0);

    // The keys move the view straight away, with nothing pressed first: the view holds the focus. Safari glides there,
    // and a key pressed mid-glide is lost, so wait until it rests.
    const top = () => page.evaluate(() => document.body.scrollTop);
    for (const key of ["ArrowDown", "PageDown", "Space"]) {
      const before = await top();
      await page.keyboard.press(key);
      await expect.poll(top, key).toBeGreaterThan(before);
    }
    await page.keyboard.press("End");
    await expect
      .poll(() => page.evaluate(() => Math.ceil(document.body.scrollTop + document.body.clientHeight)))
      .toBeGreaterThanOrEqual(await page.evaluate(() => document.body.scrollHeight - 1));
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await underTheBar(page)).toEqual([]);
    await page.keyboard.press("Home");
    await expect.poll(top).toBe(0);

    // After a move inside the app, the next long screen takes the keys too.
    await page.getByRole("link", { name: "Read the terms" }).click();
    await expect(page).toHaveURL("/terms");
    await expect.poll(top).toBe(0);
    await page.keyboard.press("PageDown");
    await expect.poll(top).toBeGreaterThan(0);

    if (!isMobile) {
      await page.keyboard.press("Home");
      await expect.poll(top).toBe(0);
      await page.mouse.move(200, 200);
      await page.mouse.wheel(0, 600);
      await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBeGreaterThan(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
    }
  });

  test("the next screen opens at its top, and Back finds the last one where it was left", async ({
    page,
  }) => {
    await opened(page, "/privacy");
    await page.evaluate(() => {
      document.body.scrollTo(0, 400);
    });
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(400);
    await page.getByRole("link", { name: "You" }).click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL("/privacy");
    await expect.poll(() => page.evaluate(() => document.body.scrollTop)).toBe(400);
  });
});

test.describe("a phone held sideways", () => {
  test.use({ storageState: CONSENTED_STATE, viewport: { width: 667, height: 375 } });
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== "phone",
      "the window is set here, so the phone's engine is enough",
    );
  });

  const turnUpright = (page: Page) => page.getByRole("dialog", { name: "Turn your phone upright" });

  test("in a browser tab, it asks for the phone upright and how to use Ruken sideways", async ({
    page,
  }, testInfo) => {
    await page.goto("/sign-in");
    await expect(turnUpright(page)).toBeVisible();
    await expect(turnUpright(page)).toContainText("add it to your Home Screen");
    await showTheOwner(page, testInfo, "sideways in a browser tab");

    // Turned upright, the screen is there as it was.
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(turnUpright(page)).toBeHidden();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // The landing page is a web page, and reads sideways.
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto("/about");
    await page.locator("main.about").waitFor();
    await expect(turnUpright(page)).toHaveCount(0);
  });

  test("opened from the Home Screen, it works sideways with the bar on the right", async ({ page }) => {
    await asInstalled(page);
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(turnUpright(page)).toBeHidden();
    const box = await boxOf(bar(page));
    expect(box.height).toBeGreaterThan(box.width);
    expect(box.x + box.width).toBeGreaterThan(667 - 24);
  });
});
