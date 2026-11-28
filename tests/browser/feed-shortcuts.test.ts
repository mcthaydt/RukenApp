import { expect, test, type Page } from "@playwright/test";
import { pageHasSettled, signUp } from "./support/account.ts";
import { consented } from "./support/consent.ts";
import { gameWhere } from "./support/game.ts";
import { beforeLaunch } from "./support/launch.ts";
import { forgetRateLimits } from "./support/rate-limits.ts";

// The feed's keys (the owner, 2026-11-22 22:05 UTC): Enter plays the clip on screen, I opens its game's page, M turns the
// sound on and off, R reposts it, and Space still moves to the next clip. Each key does what pressing that control on the
// clip on screen does, so it never acts on a clip sliding away or on one off screen.

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  // Two live games, so the feed has a clip to move to with Space; each maker signs up in a browser of their own.
  for (let made = 0; made < 2; made += 1) {
    await forgetRateLimits();
    const context = await browser.newContext({ ...consented, baseURL: "http://localhost:4173" });
    try {
      await gameWhere(await context.newPage(), { state: "live" });
    } finally {
      await context.close();
    }
  }
});
test.beforeEach(forgetRateLimits);

const current = (page: Page) => page.locator('section[data-current="true"]');

/** Opens the feed with its first clip on screen and its script started, the focus on nothing in particular. */
async function openFeed(page: Page): Promise<string> {
  await page.goto("/");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  await pageHasSettled(page);
  await expect(current(page)).toHaveCount(1);
  return (await current(page).getAttribute("data-slug")) ?? "";
}

test("Enter plays the clip on screen", async ({ page }) => {
  const slug = await openFeed(page);
  const asked = page.waitForRequest((request) =>
    new URL(request.url()).pathname.startsWith(`/g/${slug}/play`),
  );
  await page.keyboard.press("Enter");
  await asked;
});

test("before launch, Enter presses Wishlist where Play goes", async ({ page, context }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await beforeLaunch(context);
  await openFeed(page);
  const wish = current(page).locator(".band .play");
  await expect(wish).toContainText("Wishlist");
  const sent = page.waitForResponse((answer) => answer.url().includes("/wishlist"));
  await page.keyboard.press("Enter");
  expect((await sent).status()).toBeLessThan(400);
  await expect(wish).toContainText("On your wishlist");
});

test("I opens the game's page of the clip on screen", async ({ page }) => {
  const slug = await openFeed(page);
  await page.keyboard.press("i");
  await page.waitForURL((address) => address.pathname === `/g/${slug}`);
});

test("M turns the sound on and off", async ({ page }) => {
  await openFeed(page);
  const sound = page.getByRole("button", { name: "Sound" });
  const before = await sound.getAttribute("aria-pressed");
  await page.keyboard.press("m");
  await expect(sound).not.toHaveAttribute("aria-pressed", before ?? "");
  await page.keyboard.press("m");
  await expect(sound).toHaveAttribute("aria-pressed", before ?? "");
  // Held down, M repeats; the hold is one press, so the sound flips once and stays.
  await page.keyboard.down("m");
  // Three repeats after the first: four flips without the fix, which would end where it started.
  for (let repeat = 0; repeat < 3; repeat += 1) await page.keyboard.down("m");
  await page.keyboard.up("m");
  await expect(sound).not.toHaveAttribute("aria-pressed", before ?? "");
  await expect(page.locator("main.feed")).toHaveAttribute("data-ready", "true");
  expect(await sound.getAttribute("aria-pressed")).not.toBe(before);
});

test("R reposts the clip on screen, and R again takes it back", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page);
  await openFeed(page);
  const repost = current(page).getByRole("button", { name: "Repost", exact: true });
  await expect(repost).toHaveAttribute("aria-pressed", "false");
  let kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
  await page.keyboard.press("r");
  expect((await kept).status()).toBe(200);
  await expect(repost).toHaveAttribute("aria-pressed", "true");
  // A press while the last one is still being sent is dropped, as a tap is, so the second R waits for it to finish.
  await expect(repost).not.toHaveAttribute("aria-disabled", "true");
  kept = page.waitForResponse((answer) => answer.url().endsWith("/api/feed/marks"));
  await page.keyboard.press("r");
  expect((await kept).status()).toBe(200);
  await expect(repost).toHaveAttribute("aria-pressed", "false");
});

test("Space still moves to the next clip", async ({ page }) => {
  const first = await openFeed(page);
  await page.keyboard.press(" ");
  await expect(current(page)).not.toHaveAttribute("data-slug", first);
});

test("a key on a focused button keeps its own job: Enter on Share opens Share, not Play", async ({
  page,
}) => {
  await openFeed(page);
  const share = current(page).getByRole("button", { name: "Share" });
  await share.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect(page).toHaveURL((address) => address.pathname === "/");
});
