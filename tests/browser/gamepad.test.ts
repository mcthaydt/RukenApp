import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { addGame, gameWhere } from "./support/game.ts";
import { wordsHaveSettled } from "./support/look.ts";
import { PAD, padReachesEverything, plugInPad, pressPad } from "./support/pad.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// Everything works with a gamepad (the owner, 2026-11-27: "everything should be fully navigable using a gamepad"; a
// console-like experience is a key feature). A stand-in pad (support/pad.ts) is plugged into every page: the D-pad
// moves the focus, A presses, B closes or goes back, the shoulder buttons change tabs, and Home opens Ruken's menu over
// a game. The feed keeps up and down for its clips.

const ours: { slug: string; name: string }[] = [];
let free: Awaited<ReturnType<typeof addGame>>;

test.beforeAll(async ({ browser, request }) => {
  test.setTimeout(240_000);
  free = await addGame(browser, request, { free: true });
  for (let made = 0; made < 2; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      ours.push(await gameWhere(await context.newPage(), { state: "live" }));
    } finally {
      await context.close();
    }
  }
});
test.beforeEach(async ({ page }) => {
  await forgetRateLimits();
  await plugInPad(page);
});

const current = (page: Page) => page.locator('section[data-current="true"]');

async function openFeed(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("section[data-slug]").nth(1)).toBeAttached();
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await wordsHaveSettled(page);
}

test("on the feed, down and up change the clip and land on its main button; left and right reach the bar", async ({
  page,
}) => {
  await openFeed(page);
  const first = await current(page).getAttribute("data-slug");

  await pressPad(page, PAD.down);
  await expect(current(page)).not.toHaveAttribute("data-slug", first ?? "");
  // Once the slide has settled, the focus is on the new clip's main button (Play, or Wishlist before launch).
  await expect(current(page).locator(".band .button")).toBeFocused();

  await pressPad(page, PAD.up);
  await expect(current(page)).toHaveAttribute("data-slug", first ?? "");
  await expect(current(page).locator(".band .button")).toBeFocused();

  // Left from the main button is the game's name; right goes on through the clip's controls, then the bar.
  await pressPad(page, PAD.left);
  await expect(current(page).locator("a.gamelink")).toBeFocused();
  const bar = page.getByRole("navigation", { name: "Ruken" });
  for (let step = 0; step < 12; step += 1) {
    if (await bar.getByRole("link", { name: "You" }).evaluate((you) => you === document.activeElement)) break;
    await pressPad(page, PAD.right);
  }
  await expect(bar.getByRole("link", { name: "You" })).toBeFocused();
  // The ring shows where the pad is.
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
  expect(ring).not.toBe("none");

  await pressPad(page, PAD.a);
  await expect(page).not.toHaveURL("/");
});

test("A opens a game's page from the feed, and B comes back to the feed", async ({ page }) => {
  await openFeed(page);
  await pressPad(page, PAD.right);
  await expect(current(page).locator(".band .button")).toBeFocused();
  await pressPad(page, PAD.left);
  const slug = await current(page).getAttribute("data-slug");
  await pressPad(page, PAD.a);
  await expect(page).toHaveURL(`/g/${slug ?? ""}`);
  await pressPad(page, PAD.b);
  await expect(page).toHaveURL("/");
});

test("Share opens with A, its buttons are reached with the D-pad, and B closes it back onto Share", async ({
  page,
}) => {
  await openFeed(page);
  const share = current(page).getByRole("button", { name: "Share" });
  await pressPad(page, PAD.right);
  for (let step = 0; step < 8 && !(await share.evaluate((one) => one === document.activeElement)); step += 1)
    await pressPad(page, PAD.right);
  await expect(share).toBeFocused();
  await pressPad(page, PAD.a);
  const sheet = page.getByRole("dialog", { name: "Share" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Copy link" })).toBeFocused();
  // The focus stays in the sheet, whichever way the pad goes.
  for (const way of [PAD.down, PAD.right, PAD.up, PAD.up, PAD.left]) {
    await pressPad(page, way);
    expect(await sheet.evaluate((one) => one.contains(document.activeElement))).toBe(true);
  }
  await pressPad(page, PAD.b);
  await expect(sheet).toBeHidden();
  await expect(share).toBeFocused();
});

/** Opens a free game (anyone may play one) and waits for it and the page's own script. */
async function openTheGame(page: Page): Promise<void> {
  await page.goto(`/g/${free.slug}/play`, { waitUntil: "domcontentloaded" });
  await pageHasSettled(page);
  await expect(page.frameLocator("iframe.frame").locator("body")).toHaveAttribute("data-loaded", "yes");
}

test("over a game, Home opens Ruken's menu, B closes it, and A on Leave game leaves", async ({ page }) => {
  await openTheGame(page);
  const menu = page.locator("details.menu");

  await pressPad(page, PAD.home);
  await expect(menu).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "Keep playing" })).toBeFocused();
  // Down goes through the menu and stays in it.
  for (let step = 0; step < 6; step += 1) {
    await pressPad(page, PAD.down);
    expect(await page.locator(".menupanel").evaluate((one) => one.contains(document.activeElement))).toBe(
      true,
    );
  }
  await pressPad(page, PAD.b);
  await expect(menu).not.toHaveAttribute("open", "");

  // View held for a second opens it too, for a pad whose Home button the system keeps.
  await pressPad(page, PAD.view, 1100);
  await expect(menu).toHaveAttribute("open", "");
  const leave = page.getByRole("link", { name: /Leave game/ });
  for (let step = 0; step < 6 && !(await leave.evaluate((one) => one === document.activeElement)); step += 1)
    await pressPad(page, PAD.down);
  await expect(leave).toBeFocused();
  await pressPad(page, PAD.a);
  await expect(page).not.toHaveURL(/\/play$/);
});

test("on a game's frame, the pad is the game's: a press does nothing on Ruken's page", async ({ page }) => {
  await openTheGame(page);
  const frame = page.locator("iframe.frame");
  await frame.focus();
  for (const button of [PAD.a, PAD.b, PAD.down, PAD.right]) await pressPad(page, button);
  await expect(page).toHaveURL(`/g/${free.slug}/play`);
  await expect(frame).toBeFocused();
  await expect(page.locator("details.menu")).not.toHaveAttribute("open", "");
});

// Every screen a signed-out person can open: the pad reaches every control the Tab key does.
for (const path of ["/sign-in", "/sign-up", "/forgot-password", "/about", "/help", "/cookies", "/privacy"]) {
  test(`the pad reaches everything on ${path}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  });
}

test("the pad reaches everything on the price card", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/g/${ours[0]?.slug ?? ""}/play`);
  await expect(page.getByRole("heading", { name: "Join Ruken to play" })).toBeVisible();
  await wordsHaveSettled(page);
  await padReachesEverything(page);
});

test("the pad reaches everything on a game's page", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(`/g/${ours[0]?.slug ?? ""}`);
  // The page's script has started: until then the clip is the browser's own player, a stop of its own.
  await expect(page.getByRole("button", { name: "Watch the video full size" })).toBeVisible();
  await wordsHaveSettled(page);
  await padReachesEverything(page);
});

test("signed in, the pad reaches everything on You, Your games and a new game's first question, and B goes back", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await signUp(page);
  for (const path of ["/me", "/make", "/make/new"]) {
    await page.goto(path);
    await wordsHaveSettled(page);
    await padReachesEverything(page);
  }
  // B on a screen that has its own Back follows it; elsewhere it goes back through the pages Ruken opened.
  await page.goto("/me");
  await wordsHaveSettled(page);
  await page.getByRole("link", { name: "Change password" }).click();
  await expect(page).toHaveURL("/me/password");
  await wordsHaveSettled(page);
  await pressPad(page, PAD.b);
  await expect(page).toHaveURL("/me");
});
